"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessagesSquare } from "lucide-react";
import Link from "next/link";

import { AnalysisChatPanel } from "@/components/results/analysis-chat-panel";
import { ConversationList } from "@/components/results/conversation-list";
import { readPreparedRequest } from "@/components/results/prepared-review";
import {
  deleteChatMessage,
  deleteResumeReview,
  getProviderSettings,
  listResumeReviews,
  listMessagesForReview,
  type ChatMessageRecord,
  type ResumeReviewCitation,
  type ResumeReviewRecord,
  type ProviderSettingsRecord,
  upsertChatMessage,
  upsertResumeReview,
} from "@/lib/resume-review-db";

type ResultsWorkspaceProps = {
  requestId: string;
};

type ActiveChatRequest = {
  packId: string;
  requestKey: string;
  abortController: AbortController;
};

type ResumeReviewChatSseEnvelope = {
  stage?: string;
  context?: {
    suggestion_count?: number;
    resume_chunk_count?: number;
    job_description_chunk_count?: number;
    focus_points?: string[];
  };
  citation?: {
    citation_id?: string;
    source_type?: "resume" | "job_description";
    title?: string;
    excerpt?: string;
    relevance_level?: "high" | "medium" | "low";
    score?: number;
  };
  delta?: string;
  message?: string;
};

const INITIAL_REVIEW_PROMPT = "请先给我这份简历针对目标岗位的整体分析和修改建议。";
const INTERRUPTED_FOLLOW_UP_MESSAGE = "本次追问已中断，请重新发送。";

function replaceMessage(messages: ChatMessageRecord[], nextMessage: ChatMessageRecord) {
  const targetIndex = messages.findIndex((message) => message.messageId === nextMessage.messageId);
  if (targetIndex === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, index) => (index === targetIndex ? nextMessage : message));
}

function removeMessage(messages: ChatMessageRecord[], messageId: string) {
  return messages.filter((message) => message.messageId !== messageId);
}

function parseCitation(event: ResumeReviewChatSseEnvelope["citation"]): ResumeReviewCitation | null {
  if (
    event === undefined ||
    typeof event.citation_id !== "string" ||
    typeof event.source_type !== "string" ||
    typeof event.title !== "string" ||
    typeof event.excerpt !== "string"
  ) {
    return null;
  }

  return {
    id: event.citation_id,
    sourceType: event.source_type,
    title: event.title,
    snippet: event.excerpt,
    relevanceLevel: event.relevance_level,
    score: event.score,
  };
}

async function consumeSseStream(
  response: Response,
  onEvent: (eventName: string, payload: ResumeReviewChatSseEnvelope) => Promise<void> | void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("missing response stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex).replace(/\r/g, "");
      buffer = buffer.slice(boundaryIndex + 2);

      if (rawEvent.trim() !== "") {
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        const data = dataLines.join("\n");
        const payload = data ? (JSON.parse(data) as ResumeReviewChatSseEnvelope) : {};
        await onEvent(eventName, payload);
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }
}

function buildChatRequestMessages(messages: ChatMessageRecord[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function appendEphemeralUserMessage(
  messages: ReturnType<typeof buildChatRequestMessages>,
  userMessageContent: string,
) {
  const trimmedUserMessage = userMessageContent.trim();
  if (trimmedUserMessage === "") {
    return messages;
  }

  return [
    ...messages,
    {
      role: "user" as const,
      content: trimmedUserMessage,
    },
  ];
}

export function ResultsWorkspace({ requestId }: ResultsWorkspaceProps) {
  const [packs, setPacks] = useState<ResumeReviewRecord[]>([]);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [hydratedPackId, setHydratedPackId] = useState<string | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettingsRecord | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const packsRef = useRef<ResumeReviewRecord[]>([]);
  const activePackIdRef = useRef<string | null>(null);
  const inFlightPackIdRef = useRef<string | null>(null);
  const activeChatRequestRef = useRef<ActiveChatRequest | null>(null);

  useEffect(() => {
    packsRef.current = packs;
  }, [packs]);

  useEffect(() => {
    activePackIdRef.current = activePackId;
  }, [activePackId]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateWorkspace() {
      const preparedRequest = readPreparedRequest(requestId);
      let nextPacks = await listResumeReviews();

      if (preparedRequest !== null) {
        const matchingPacks = nextPacks.filter(
          (pack) => pack.requestId === preparedRequest.requestId,
        );
        const rankedMatches = await Promise.all(
          matchingPacks.map(async (pack) => ({
            pack,
            messageCount: (await listMessagesForReview(pack.reviewId)).length,
          })),
        );
        rankedMatches.sort((left, right) => {
          if (right.messageCount !== left.messageCount) {
            return right.messageCount - left.messageCount;
          }

          return right.pack.updatedAt - left.pack.updatedAt;
        });

        const existingPack = rankedMatches[0]?.pack;
        const duplicatePacks = rankedMatches.slice(1).map((entry) => entry.pack);

        if (duplicatePacks.length > 0) {
          await Promise.all(duplicatePacks.map((pack) => deleteResumeReview(pack.reviewId)));
        }

        await upsertResumeReview({
          reviewId: existingPack?.reviewId ?? preparedRequest.requestId,
          requestId: preparedRequest.requestId,
          resumeDocumentId: preparedRequest.resumeDocumentId,
          jobDescriptionDocumentId: preparedRequest.jobDescriptionDocumentId,
          suggestionCount: preparedRequest.suggestionCount,
          targetRole: preparedRequest.targetRole,
          resumePreview: preparedRequest.resumePreview,
          jobDescriptionPreview: preparedRequest.jobDescriptionPreview,
          analysisStatus: existingPack?.analysisStatus ?? "pending",
          createdAt: existingPack?.createdAt,
          updatedAt: Date.now(),
          lastOpenedAt: Date.now(),
        });

        nextPacks = await listResumeReviews();
      }

      const nextProviderSettings = await getProviderSettings();

      if (cancelled) {
        return;
      }

      setProviderSettings(nextProviderSettings);
      setPacks(nextPacks);

      const matchingPack = nextPacks.find((pack) => pack.requestId === requestId);
      setActivePackId(matchingPack?.reviewId ?? nextPacks[0]?.reviewId ?? null);
    }

    void hydrateWorkspace();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (activePackId === null) {
      setMessages([]);
      setHydratedPackId(null);
      setWorkspaceError(null);
      return;
    }
    const activePackIdValue = activePackId;

    let cancelled = false;
    setMessages([]);
    setHydratedPackId(null);
    setWorkspaceError(null);

    async function loadMessages() {
      const activePack = packsRef.current.find((pack) => pack.reviewId === activePackIdValue);
      if (activePack) {
        await upsertResumeReview({
          ...activePack,
          lastOpenedAt: Date.now(),
        });
      }

      const [nextMessages, nextPacks] = await Promise.all([
        listMessagesForReview(activePackIdValue),
        listResumeReviews(),
      ]);

      if (cancelled) {
        return;
      }

      setMessages(nextMessages);
      setHydratedPackId(activePackIdValue);
      setPacks(nextPacks);
    }

    void loadMessages();

    return () => {
      cancelled = true;
      if (activeChatRequestRef.current?.packId === activePackIdValue) {
        activeChatRequestRef.current.abortController.abort();
        activeChatRequestRef.current = null;
        if (inFlightPackIdRef.current === activePackIdValue) {
          inFlightPackIdRef.current = null;
        }
        setIsSending(false);
      }
    };
  }, [activePackId]);

  const activePack = activePackId
    ? packs.find((pack) => pack.reviewId === activePackId) ?? null
    : null;

  function isActiveChatRequest(requestKey: string, packId: string): boolean {
    const activeChatRequest = activeChatRequestRef.current;
    return (
      activeChatRequest !== null &&
      activeChatRequest.requestKey === requestKey &&
      activeChatRequest.packId === packId
    );
  }

  async function startChatTurn(
    pack: ResumeReviewRecord,
    currentMessages: ChatMessageRecord[],
    userMessageContent: string,
    assistantKind: ChatMessageRecord["kind"],
  ) {
    if (inFlightPackIdRef.current === pack.reviewId) {
      return;
    }

    inFlightPackIdRef.current = pack.reviewId;
    setIsSending(true);
    setWorkspaceError(null);
    const requestKey = `${pack.reviewId}:${Date.now()}`;
    const abortController = new AbortController();
    activeChatRequestRef.current = {
      packId: pack.reviewId,
      requestKey,
      abortController,
    };

    let requestMessages = currentMessages;
    let requestPayloadMessages = buildChatRequestMessages(currentMessages);
    const trimmedUserMessage = userMessageContent.trim();
    if (trimmedUserMessage !== "" && assistantKind === "follow_up") {
      const userMessage = await upsertChatMessage({
        messageId: `user:${pack.reviewId}:${Date.now()}`,
        reviewId: pack.reviewId,
        role: "user",
        kind: "follow_up",
        content: trimmedUserMessage,
        status: "done",
        citations: [],
      });
      requestMessages = [...currentMessages, userMessage];
      requestPayloadMessages = buildChatRequestMessages(requestMessages);
      setMessages((existingMessages) => replaceMessage(existingMessages, userMessage));
    } else {
      requestPayloadMessages = appendEphemeralUserMessage(requestPayloadMessages, trimmedUserMessage);
    }

    let assistantMessage = await upsertChatMessage({
      messageId: `assistant:${pack.reviewId}:${Date.now()}`,
      reviewId: pack.reviewId,
      role: "assistant",
      kind: assistantKind,
      content: "",
      status: "streaming",
      citations: [],
    });
    setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));

    await upsertResumeReview({
      ...pack,
      analysisStatus: "streaming",
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
    });
    setPacks(await listResumeReviews());

    try {
      const response = await fetch("/api/resume-reviews/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reviewId: pack.reviewId,
          requestId: pack.requestId,
          resumeDocumentId: pack.resumeDocumentId,
          jobDescriptionDocumentId: pack.jobDescriptionDocumentId,
          suggestionCount: pack.suggestionCount,
          targetRole: pack.targetRole,
          messages: requestPayloadMessages,
          localModelSettings:
            providerSettings === null
              ? null
              : {
                  protocol: providerSettings.protocol,
                  apiKey: providerSettings.apiKey,
                  model: providerSettings.model,
                  baseUrl: providerSettings.baseUrl,
                },
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorMessage =
          response.status === 403
            ? "免费额度已用完，请先配置本地模型设置。"
            : assistantKind === "initial_analysis"
              ? "初始分析生成失败，请稍后重试。"
              : "追问发送失败，请稍后重试。";
        assistantMessage = await upsertChatMessage({
          ...assistantMessage,
          status: "error",
          content: errorMessage,
          updatedAt: Date.now(),
        });
        await upsertResumeReview({
          ...pack,
          analysisStatus: "error",
          updatedAt: Date.now(),
        });
        if (isActiveChatRequest(requestKey, pack.reviewId)) {
          setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
          setPacks(await listResumeReviews());
          setWorkspaceError(errorMessage);
        }
        return;
      }

      await consumeSseStream(response, async (eventName, payload) => {
        if (!isActiveChatRequest(requestKey, pack.reviewId)) {
          return;
        }

        if (eventName === "citation") {
          const citation = parseCitation(payload.citation);
          if (citation === null) {
            return;
          }

          assistantMessage = await upsertChatMessage({
            ...assistantMessage,
            citations: [...assistantMessage.citations, citation],
            updatedAt: Date.now(),
          });
          setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
          return;
        }

        if (eventName === "delta" && typeof payload.delta === "string") {
          assistantMessage = await upsertChatMessage({
            ...assistantMessage,
            content: `${assistantMessage.content}${payload.delta}`,
            updatedAt: Date.now(),
          });
          setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
          return;
        }

        if (eventName === "error") {
          assistantMessage = await upsertChatMessage({
            ...assistantMessage,
            status: "error",
            content:
              assistantMessage.content ||
              payload.message ||
              (assistantKind === "initial_analysis"
                ? "初始分析生成失败，请稍后重试。"
                : "追问发送失败，请稍后重试。"),
            updatedAt: Date.now(),
          });
          await upsertResumeReview({
            ...pack,
            analysisStatus: "error",
            updatedAt: Date.now(),
          });
          setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
          setPacks(await listResumeReviews());
          setWorkspaceError(payload.message ?? "生成失败，请稍后重试。");
          return;
        }

        if (eventName === "done") {
          assistantMessage = await upsertChatMessage({
            ...assistantMessage,
            status: "done",
            updatedAt: Date.now(),
          });
          await upsertResumeReview({
            ...pack,
            analysisStatus: "completed",
            updatedAt: Date.now(),
          });
          setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
          setPacks(await listResumeReviews());
        }
      });

      if (isActiveChatRequest(requestKey, pack.reviewId) && assistantMessage.status === "streaming") {
        const errorMessage =
          assistantKind === "initial_analysis"
            ? "初始分析生成失败，请稍后重试。"
            : "追问发送失败，请稍后重试。";
        assistantMessage = await upsertChatMessage({
          ...assistantMessage,
          status: "error",
          content: assistantMessage.content || errorMessage,
          updatedAt: Date.now(),
        });
        await upsertResumeReview({
          ...pack,
          analysisStatus: "error",
          updatedAt: Date.now(),
        });
        setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
        setPacks(await listResumeReviews());
        setWorkspaceError(errorMessage);
      }
    } catch {
      const wasAborted = abortController.signal.aborted;
      if (wasAborted) {
        if (assistantKind === "initial_analysis") {
          await deleteChatMessage(assistantMessage.messageId);
          await upsertResumeReview({
            ...pack,
            analysisStatus: "pending",
            updatedAt: Date.now(),
          });
          if (activePackIdRef.current === pack.reviewId) {
            const [nextMessages, nextPacks] = await Promise.all([
              listMessagesForReview(pack.reviewId),
              listResumeReviews(),
            ]);
            const visibleMessages = removeMessage(nextMessages, assistantMessage.messageId);
            const nextPack =
              nextPacks.find((candidate) => candidate.reviewId === pack.reviewId) ?? {
                ...pack,
                analysisStatus: "pending" as const,
              };
            setMessages(visibleMessages);
            setHydratedPackId(pack.reviewId);
            setPacks(nextPacks);
            if (visibleMessages.length === 0) {
              await startChatTurn(nextPack, [], INITIAL_REVIEW_PROMPT, "initial_analysis");
            }
          }
        } else {
          assistantMessage = await upsertChatMessage({
            ...assistantMessage,
            status: "error",
            content: assistantMessage.content || INTERRUPTED_FOLLOW_UP_MESSAGE,
            updatedAt: Date.now(),
          });
          await upsertResumeReview({
            ...pack,
            analysisStatus: "error",
            updatedAt: Date.now(),
          });
          if (activePackIdRef.current === pack.reviewId) {
            const [nextMessages, nextPacks] = await Promise.all([
              listMessagesForReview(pack.reviewId),
              listResumeReviews(),
            ]);
            setMessages(nextMessages);
            setHydratedPackId(pack.reviewId);
            setPacks(nextPacks);
            setWorkspaceError(INTERRUPTED_FOLLOW_UP_MESSAGE);
          }
        }
        return;
      }

      const errorMessage =
        assistantKind === "initial_analysis"
          ? "初始分析生成失败，请稍后重试。"
          : "追问发送失败，请稍后重试。";
      assistantMessage = await upsertChatMessage({
        ...assistantMessage,
        status: "error",
        content: assistantMessage.content || errorMessage,
        updatedAt: Date.now(),
      });
      await upsertResumeReview({
        ...pack,
        analysisStatus: "error",
        updatedAt: Date.now(),
      });
      if (isActiveChatRequest(requestKey, pack.reviewId)) {
        setMessages((existingMessages) => replaceMessage(existingMessages, assistantMessage));
        setPacks(await listResumeReviews());
        setWorkspaceError(errorMessage);
      }
    } finally {
      if (isActiveChatRequest(requestKey, pack.reviewId)) {
        activeChatRequestRef.current = null;
      }
      if (inFlightPackIdRef.current === pack.reviewId) {
        inFlightPackIdRef.current = null;
      }
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (activePack === null || hydratedPackId !== activePack.reviewId) {
      return;
    }
    const activePackValue = activePack;

    if (messages.length > 0 || inFlightPackIdRef.current === activePackValue.reviewId) {
      return;
    }

    async function startInitialChat() {
      await startChatTurn(activePackValue, [], INITIAL_REVIEW_PROMPT, "initial_analysis");
    }

    void startInitialChat();
  }, [activePack, hydratedPackId, isSending, messages, providerSettings]);

  async function handleSendMessage(message: string) {
    if (activePack === null) {
      return;
    }

    await startChatTurn(activePack, messages, message, "follow_up");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1320px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <section className="border-2 border-foreground bg-card px-5 py-3 shadow-[6px_6px_0_#161616] sm:px-6 sm:py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-mono text-[1.02rem] uppercase tracking-[0.06em] text-foreground sm:text-[1.08rem]">
              简历分析工作台
            </h1>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <Link
                className="inline-flex items-center gap-2 border-2 border-foreground bg-[#161616] px-4 py-3 font-mono text-[0.78rem] uppercase tracking-[0.08em] text-[#f7f2ea] shadow-[4px_4px_0_#161616]"
                href="/workspace"
              >
                返回工作台
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-5 xl:items-stretch xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 space-y-5 xl:sticky xl:top-5 xl:h-[calc(100dvh-9.1rem)] xl:self-start">
            <section className="flex h-full min-h-0 flex-col overflow-hidden border-2 border-foreground bg-card p-4 shadow-[5px_5px_0_#161616]">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4" strokeWidth={1.5} />
                <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                  对话列表
                </p>
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <ConversationList
                  activeReviewId={activePackId}
                  reviews={packs}
                  onSelect={setActivePackId}
                />
              </div>
            </section>
          </aside>

          <div className="min-w-0 space-y-5 xl:sticky xl:top-5 xl:self-start">
            <AnalysisChatPanel
              isSending={isSending}
              messages={messages}
              onSend={handleSendMessage}
              review={activePack}
              requestId={activePack?.requestId ?? requestId}
              workspaceError={workspaceError}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

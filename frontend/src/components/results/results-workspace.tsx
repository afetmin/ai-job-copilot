"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessagesSquare, Settings2 } from "lucide-react";
import Link from "next/link";

import { AnalysisChatPanel } from "@/components/results/analysis-chat-panel";
import { ConversationList } from "@/components/results/conversation-list";
import { ModelSettingsCard } from "@/components/results/model-settings-card";
import { readPreparedRequest } from "@/components/results/prepared-review";
import { Button } from "@/components/ui/button";
import {
  deleteResumeReview,
  getProviderSettings,
  listResumeReviews,
  listMessagesForReview,
  saveProviderSettings,
  type ChatMessageRecord,
  type ResumeReviewCitation,
  type ResumeReviewRecord,
  type ProviderSettingsInput,
  type ProviderSettingsRecord,
  upsertChatMessage,
  upsertResumeReview,
} from "@/lib/resume-review-db";

type ResultsWorkspaceProps = {
  requestId: string;
};

type InitialAnalysisSseEnvelope = {
  stage?: string;
  metadata?: {
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
    score?: number;
  };
  delta?: string;
  message?: string;
};

function replaceMessage(messages: ChatMessageRecord[], nextMessage: ChatMessageRecord) {
  const targetIndex = messages.findIndex((message) => message.messageId === nextMessage.messageId);
  if (targetIndex === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, index) => (index === targetIndex ? nextMessage : message));
}

function parseCitation(event: InitialAnalysisSseEnvelope["citation"]): ResumeReviewCitation | null {
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
    score: event.score,
  };
}

async function consumeSseStream(
  response: Response,
  onEvent: (eventName: string, payload: InitialAnalysisSseEnvelope) => Promise<void> | void,
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
        const payload = data ? (JSON.parse(data) as InitialAnalysisSseEnvelope) : {};
        await onEvent(eventName, payload);
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }
}

export function ResultsWorkspace({ requestId }: ResultsWorkspaceProps) {
  const [packs, setPacks] = useState<ResumeReviewRecord[]>([]);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [hydratedPackId, setHydratedPackId] = useState<string | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettingsRecord | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const packsRef = useRef<ResumeReviewRecord[]>([]);
  const inFlightPackIdRef = useRef<string | null>(null);

  useEffect(() => {
    packsRef.current = packs;
  }, [packs]);

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

    let cancelled = false;
    setMessages([]);
    setHydratedPackId(null);
    setWorkspaceError(null);

    async function loadMessages() {
      const activePack = packsRef.current.find((pack) => pack.reviewId === activePackId);
      if (activePack) {
        await upsertResumeReview({
          ...activePack,
          lastOpenedAt: Date.now(),
        });
      }

      const [nextMessages, nextPacks] = await Promise.all([
        listMessagesForReview(activePackId),
        listResumeReviews(),
      ]);

      if (cancelled) {
        return;
      }

      setMessages(nextMessages);
      setHydratedPackId(activePackId);
      setPacks(nextPacks);
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activePackId]);

  useEffect(() => {
    if (!isModelSettingsOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsModelSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModelSettingsOpen]);

  const activePack = activePackId
    ? packs.find((pack) => pack.reviewId === activePackId) ?? null
    : null;

  useEffect(() => {
    if (activePack === null || hydratedPackId !== activePack.reviewId) {
      return;
    }

    const hasInitialAnalysisMessage = messages.some(
      (message) =>
        message.reviewId === activePack.reviewId &&
        message.role === "assistant" &&
        message.kind === "initial_analysis",
    );

    if (hasInitialAnalysisMessage || inFlightPackIdRef.current === activePack.reviewId) {
      return;
    }

    let cancelled = false;

    async function startInitialAnalysisStream() {
      inFlightPackIdRef.current = activePack.reviewId;
      setWorkspaceError(null);

      let analysisMessage = await upsertChatMessage({
        messageId: `initial-analysis:${activePack.reviewId}`,
        reviewId: activePack.reviewId,
        role: "assistant",
        kind: "initial_analysis",
        content: "",
        status: "streaming",
        citations: [],
      });

      if (!cancelled) {
        setMessages((currentMessages) => replaceMessage(currentMessages, analysisMessage));
      }

      await upsertResumeReview({
        ...activePack,
        analysisStatus: "streaming",
        updatedAt: Date.now(),
        lastOpenedAt: Date.now(),
      });
      if (!cancelled) {
        setPacks(await listResumeReviews());
      }

      const response = await fetch("/api/resume-reviews/analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reviewId: activePack.reviewId,
          requestId: activePack.requestId,
          resumeDocumentId: activePack.resumeDocumentId,
          jobDescriptionDocumentId: activePack.jobDescriptionDocumentId,
          suggestionCount: activePack.suggestionCount,
          targetRole: activePack.targetRole,
          localModelSettings:
            providerSettings === null
              ? null
              : {
                  provider: providerSettings.provider,
                  apiKey: providerSettings.apiKey,
                  model: providerSettings.model,
                  baseUrl: providerSettings.baseUrl,
                },
        }),
      });

      if (!response.ok) {
        analysisMessage = await upsertChatMessage({
          ...analysisMessage,
          status: "error",
          content: "初始分析生成失败，请稍后重试。",
          updatedAt: Date.now(),
        });
        await upsertResumeReview({
          ...activePack,
          analysisStatus: "error",
          updatedAt: Date.now(),
        });
        if (!cancelled) {
          setMessages((currentMessages) => replaceMessage(currentMessages, analysisMessage));
          setPacks(await listResumeReviews());
          setWorkspaceError("初始分析生成失败，请稍后重试。");
        }
        inFlightPackIdRef.current = null;
        return;
      }

      await consumeSseStream(response, async (eventName, payload) => {
        if (cancelled) {
          return;
        }

        if (eventName === "citation") {
          const citation = parseCitation(payload.citation);
          if (citation === null) {
            return;
          }

          analysisMessage = await upsertChatMessage({
            ...analysisMessage,
            citations: [...analysisMessage.citations, citation],
            updatedAt: Date.now(),
          });
          setMessages((currentMessages) => replaceMessage(currentMessages, analysisMessage));
          return;
        }

        if (eventName === "delta" && typeof payload.delta === "string") {
          analysisMessage = await upsertChatMessage({
            ...analysisMessage,
            content: `${analysisMessage.content}${payload.delta}`,
            updatedAt: Date.now(),
          });
          setMessages((currentMessages) => replaceMessage(currentMessages, analysisMessage));
          return;
        }

        if (eventName === "error") {
          analysisMessage = await upsertChatMessage({
            ...analysisMessage,
            status: "error",
            content:
              analysisMessage.content || payload.message || "初始分析生成失败，请稍后重试。",
            updatedAt: Date.now(),
          });
          await upsertResumeReview({
            ...activePack,
            analysisStatus: "error",
            updatedAt: Date.now(),
          });
          setMessages((currentMessages) => replaceMessage(currentMessages, analysisMessage));
          setPacks(await listResumeReviews());
          setWorkspaceError(payload.message ?? "初始分析生成失败，请稍后重试。");
          return;
        }

        if (eventName === "done") {
          analysisMessage = await upsertChatMessage({
            ...analysisMessage,
            status: "done",
            updatedAt: Date.now(),
          });
          await upsertResumeReview({
            ...activePack,
            analysisStatus: "completed",
            updatedAt: Date.now(),
          });
          setMessages((currentMessages) => replaceMessage(currentMessages, analysisMessage));
          setPacks(await listResumeReviews());
        }
      });

      inFlightPackIdRef.current = null;
    }

    void startInitialAnalysisStream();

    return () => {
      cancelled = true;
      inFlightPackIdRef.current = null;
    };
  }, [activePack, hydratedPackId, messages, providerSettings]);

  async function handleSaveProviderSettings(input: ProviderSettingsInput) {
    await saveProviderSettings(input);
    setProviderSettings(await getProviderSettings());
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-end">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setIsModelSettingsOpen(true)} size="lg" type="button" variant="secondary">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" strokeWidth={1.5} />
                模型配置
              </span>
            </Button>
            <Link
              className="inline-flex items-center gap-2 border-2 border-foreground bg-[#161616] px-4 py-3 font-mono text-[0.78rem] uppercase tracking-[0.08em] text-[#f7f2ea] shadow-[4px_4px_0_#161616]"
              href="/workspace"
            >
              返回工作台
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>

        <section className="mt-5 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="border-2 border-foreground bg-card p-5 shadow-[5px_5px_0_#161616]">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4" strokeWidth={1.5} />
                <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                  对话列表
                </p>
              </div>
              <div className="mt-4 space-y-4">
                <div className="border-2 border-foreground/10 bg-[rgba(255,255,255,0.5)] p-4">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                    当前对话
                  </p>
                  <p className="mt-2 font-mono text-[0.88rem] uppercase tracking-[0.08em]">
                    {activePack?.targetRole ?? "未命名岗位"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {packs.length > 0
                      ? `当前共 ${packs.length} 个对话，右侧会按时间顺序展示所选对话的全部消息。`
                      : "当前还没有可浏览的对话内容。"}
                  </p>
                </div>
                <ConversationList
                  activeReviewId={activePackId}
                  reviews={packs}
                  onSelect={setActivePackId}
                />
              </div>
            </section>

            <section className="border-2 border-foreground bg-[rgba(251,247,242,0.94)] p-4 shadow-[5px_5px_0_#161616]">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                结果页工作区
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                左侧按档案切换对话，右侧在同一聊天流里连续展示初始信息、追问和后续回复。
              </p>
            </section>
          </aside>

          <div className="space-y-6">
            <AnalysisChatPanel
              messages={messages}
              review={activePack}
              requestId={activePack?.requestId ?? requestId}
              workspaceError={workspaceError}
            />
          </div>
        </section>

        {isModelSettingsOpen ? (
          <div
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
            role="dialog"
          >
            <button
              aria-label="关闭模型配置弹窗"
              className="absolute inset-0"
              onClick={() => setIsModelSettingsOpen(false)}
              type="button"
            />
            <div className="relative z-10 w-full max-w-[560px] border-2 border-foreground bg-[rgba(251,247,242,0.98)] p-5 shadow-[10px_10px_0_#161616] sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b-2 border-foreground/10 pb-4">
                <div>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                    模型配置
                  </p>
                  <h2 className="mt-2 font-mono text-[1.2rem] uppercase tracking-[0.08em]">
                    本机模型设置
                  </h2>
                </div>
                <Button onClick={() => setIsModelSettingsOpen(false)} size="sm" type="button" variant="ghost">
                  关闭
                </Button>
              </div>
              <div className="mt-5">
                <ModelSettingsCard
                  onSave={handleSaveProviderSettings}
                  settings={providerSettings}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

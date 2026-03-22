"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquareText, SendHorizontal } from "lucide-react";

import type { ChatMessageRecord, ResumeReviewRecord } from "@/lib/resume-review-db";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { ChatMessage } from "./chat-message";

type AnalysisChatPanelProps = {
  review: ResumeReviewRecord | null;
  messages: ChatMessageRecord[];
  requestId: string;
  workspaceError: string | null;
  isSending: boolean;
  onSend: (message: string) => Promise<void>;
};

function formatStatus(status: ResumeReviewRecord["analysisStatus"] | undefined): string {
  if (status === "completed") {
    return "已完成";
  }

  if (status === "streaming") {
    return "生成中";
  }

  if (status === "error") {
    return "异常";
  }

  return "待开始";
}

function totalCitations(messages: ChatMessageRecord[]): number {
  return messages.reduce((sum, message) => sum + message.citations.length, 0);
}

function infoItems(
  review: ResumeReviewRecord | null,
  messages: ChatMessageRecord[],
  requestId: string,
) {
  return [
    { label: "岗位", value: review?.targetRole ?? "未命名岗位" },
    { label: "Request ID", value: requestId },
    { label: "状态", value: formatStatus(review?.analysisStatus) },
    { label: "消息数", value: String(messages.length) },
    { label: "引用数", value: String(totalCitations(messages)) },
  ];
}

export function AnalysisChatPanel({
  review,
  messages,
  requestId,
  workspaceError,
  isSending,
  onSend,
}: AnalysisChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const metadataItems = infoItems(review, messages, requestId);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [isSending, messages]);

  async function handleSend() {
    const nextMessage = draft.trim();
    if (nextMessage === "" || isSending) {
      return;
    }

    setDraft("");
    await onSend(nextMessage);
  }

  return (
    <section className="flex h-[calc(100dvh-8.8rem)] min-h-0 min-w-0 flex-col overflow-hidden border-2 border-foreground bg-card shadow-[6px_6px_0_#161616] sm:h-[calc(100dvh-9.1rem)]">
      <div className="shrink-0 border-b-2 border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" strokeWidth={1.5} />
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
            分析对话
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {metadataItems.map((item) => (
            <div
              key={item.label}
              className="border border-foreground/15 bg-[rgba(255,255,255,0.5)] px-3 py-2"
            >
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 line-clamp-1 font-mono text-[0.74rem] uppercase tracking-[0.06em]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-label="分析消息流"
        className="paper-scrollbar min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(rgba(22,22,22,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(22,22,22,0.06)_1px,transparent_1px)] bg-[size:28px_28px] px-4 py-4"
        ref={scrollContainerRef}
      >
        {workspaceError ? (
          <div className="mb-4 border-2 border-destructive bg-card px-4 py-3 text-sm leading-6 text-destructive shadow-[4px_4px_0_#161616]">
            {workspaceError}
          </div>
        ) : null}

        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((message) => (
              <ChatMessage key={message.messageId} message={message} />
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-foreground/25 bg-background/90 p-5 text-sm leading-6 text-muted-foreground">
            当前对话还没有消息，初始化内容生成后会从第一条气泡开始显示。
          </div>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-foreground bg-[rgba(251,247,242,0.98)] px-4 py-3">
        <div className="rounded-[2px] border-2 border-foreground bg-background p-2.5 shadow-[4px_4px_0_#161616]">
          <label
            className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted-foreground"
            htmlFor="results-chat-input"
          >
            输入修改追问
          </label>
          <div className="mt-2.5 flex items-end gap-2.5">
            <Textarea
              className="min-h-[68px] resize-none px-3 py-2.5 shadow-none"
              id="results-chat-input"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="继续追问这份简历哪里需要修改。"
              value={draft}
            />
            <Button
              disabled={isSending || draft.trim() === ""}
              onClick={() => void handleSend()}
              size="lg"
              type="button"
              variant="secondary"
            >
              <span className="flex items-center gap-2">
                <SendHorizontal className="h-4 w-4" strokeWidth={1.5} />
                {isSending ? "发送中" : "发送"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

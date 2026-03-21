"use client";

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
};

function formatStatus(status: ResumeReviewRecord["analysisStatus"] | undefined): string {
  if (status === "completed") {
    return "READY";
  }

  if (status === "streaming") {
    return "STREAMING";
  }

  if (status === "error") {
    return "ERROR";
  }

  return "PENDING";
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
}: AnalysisChatPanelProps) {
  const metadataItems = infoItems(review, messages, requestId);

  return (
    <section className="flex min-h-[720px] flex-col overflow-hidden border-2 border-foreground bg-card shadow-[6px_6px_0_#161616]">
      <div className="border-b-2 border-foreground/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" strokeWidth={1.5} />
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
            分析对话
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metadataItems.map((item) => (
            <div
              key={item.label}
              className="border border-foreground/15 bg-[rgba(255,255,255,0.5)] px-3 py-2.5"
            >
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.08em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1.5 line-clamp-2 font-mono text-[0.76rem] uppercase tracking-[0.06em]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[linear-gradient(rgba(22,22,22,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(22,22,22,0.06)_1px,transparent_1px)] bg-[size:28px_28px] px-5 py-5">
        {workspaceError ? (
          <div className="mb-4 border-2 border-destructive bg-card px-4 py-3 text-sm leading-6 text-destructive shadow-[4px_4px_0_#161616]">
            {workspaceError}
          </div>
        ) : null}

        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <ChatMessage
                index={message.kind === "initial_analysis" ? 0 : index}
                key={message.messageId}
                message={message}
              />
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-foreground/25 bg-background/90 p-5 text-sm leading-6 text-muted-foreground">
            当前对话还没有消息，初始化内容生成后会从第一条气泡开始显示。
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t-2 border-foreground bg-[rgba(251,247,242,0.98)] px-5 py-4">
        <div className="rounded-[2px] border-2 border-foreground bg-background p-3 shadow-[4px_4px_0_#161616]">
          <label
            className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted-foreground"
            htmlFor="results-chat-input"
          >
            输入修改追问
          </label>
          <div className="mt-3 flex items-end gap-3">
            <Textarea
              className="min-h-[84px] resize-none shadow-none"
              id="results-chat-input"
              placeholder="继续追问这份简历哪里需要修改，下一步会接入发送逻辑。"
            />
            <Button disabled size="lg" type="button" variant="secondary">
              <span className="flex items-center gap-2">
                <SendHorizontal className="h-4 w-4" strokeWidth={1.5} />
                发送
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

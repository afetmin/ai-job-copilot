"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessageRecord } from "@/lib/resume-review-db";

type ChatMessageProps = {
  message: ChatMessageRecord;
  index?: number;
};

function messageKindLabel(message: ChatMessageRecord, index: number): string {
  if (message.kind === "initial_analysis") {
    return "初始分析";
  }

  if (message.kind === "follow_up") {
    return `追问 ${index}`;
  }

  return "系统消息";
}

function sourceLabel(sourceType: "resume" | "job_description"): string {
  return sourceType === "resume" ? "Resume" : "JD";
}

export function ChatMessage({ message, index = 0 }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const label = messageKindLabel(message, index);
  const citationsLabel = `${message.citations.length} citations`;

  return (
    <article
      className={`border-2 p-4 shadow-[4px_4px_0_#161616] ${
        isAssistant
          ? "border-foreground bg-card text-foreground"
          : "ml-auto max-w-[92%] border-foreground bg-[#161616] text-[#f7f2ea]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] opacity-70">
          <span>{isAssistant ? "Assistant" : "You"}</span>
          <span className="opacity-40">/</span>
          <span>{label}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 font-mono text-[0.66rem] uppercase tracking-[0.08em] opacity-60">
          <span>
            {message.status === "streaming"
              ? "Streaming"
              : message.status === "error"
                ? "Error"
                : "Ready"}
          </span>
          <span className="opacity-40">/</span>
          <span>{citationsLabel}</span>
        </div>
      </div>

      {isAssistant ? (
        <div className="prose prose-sm mt-3 max-w-none prose-headings:mb-3 prose-headings:font-mono prose-headings:text-[1rem] prose-headings:uppercase prose-headings:tracking-[0.08em] prose-p:my-2 prose-p:text-foreground prose-strong:text-foreground prose-li:my-1 prose-li:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || "正在整理简历优化分析..."}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      )}

      {isAssistant && message.citations.length > 0 ? (
        <section className="mt-4 border-t border-foreground/15 pt-3">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
            引用依据 ({message.citations.length})
          </p>
          <div className="mt-2 grid gap-2">
            {message.citations.map((citation) => (
              <div
                key={citation.id}
                className="border border-foreground/20 bg-[rgba(255,255,255,0.55)] p-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
                    {sourceLabel(citation.sourceType)}
                  </p>
                  {typeof citation.score === "number" ? (
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                      {citation.score.toFixed(2)}
                    </p>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm leading-6 text-foreground">{citation.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{citation.snippet}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

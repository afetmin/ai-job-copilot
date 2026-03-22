"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessageRecord, ResumeReviewCitation } from "@/lib/resume-review-db";

type ChatMessageProps = {
  message: ChatMessageRecord;
};

const CITATION_POPOVER_CLOSE_DELAY_MS = 180;

function messageKindLabel(message: ChatMessageRecord): string {
  if (message.kind === "initial_analysis") {
    return "初始分析";
  }

  if (message.kind === "follow_up") {
    return message.role === "assistant" ? "回复" : "追问";
  }

  return "系统消息";
}

function sourceLabel(sourceType: "resume" | "job_description"): string {
  return sourceType === "resume" ? "简历" : "岗位JD";
}

function sourceMonogram(sourceType: "resume" | "job_description"): string {
  return sourceType === "resume" ? "简" : "岗";
}

function sourceBadgeTone(sourceType: "resume" | "job_description"): string {
  return sourceType === "resume"
    ? "border-[#2f6fed]/30 bg-[#2f6fed]/10 text-[#1747a6]"
    : "border-[#a64b18]/30 bg-[#a64b18]/10 text-[#7b3410]";
}

function relevanceLabel(level: ResumeReviewCitation["relevanceLevel"]): string | null {
  if (level === "high") {
    return "高相关";
  }
  if (level === "medium") {
    return "中相关";
  }
  if (level === "low") {
    return "低相关";
  }
  return null;
}

function CitationBadge({ citation }: { citation: ResumeReviewCitation }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const relevance = relevanceLabel(citation.relevanceLevel);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openPopover() {
    clearCloseTimer();
    setIsOpen(true);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, CITATION_POPOVER_CLOSE_DELAY_MS);
  }

  useEffect(() => clearCloseTimer, []);

  return (
    <div
      className="group relative hover:z-[999] focus-within:z-[999]"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
    >
      <button
        tabIndex={0}
        aria-label={`${sourceLabel(citation.sourceType)} 引用：${citation.title}`}
        aria-expanded={isOpen}
        className={`inline-flex h-9 w-9 items-center justify-center border text-[0.62rem] font-mono uppercase tracking-[0.08em] shadow-[2px_2px_0_#161616] outline-none transition-transform duration-150 ease-out hover:-translate-x-px hover:-translate-y-px focus-visible:-translate-x-px focus-visible:-translate-y-px ${sourceBadgeTone(citation.sourceType)}`}
        onBlur={scheduleClose}
        onFocus={openPopover}
        type="button"
      >
        <span className="sr-only">{sourceLabel(citation.sourceType)}</span>
        {sourceMonogram(citation.sourceType)}
      </button>

      {isOpen ? (
        <div
          className="paper-scrollbar-compact absolute bottom-full left-0 z-[999] mb-1 max-h-64 w-72 overflow-y-auto border-2 border-foreground bg-card p-3 text-left shadow-[4px_4px_0_#161616]"
          onBlur={scheduleClose}
          onFocus={openPopover}
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
          role="tooltip"
          tabIndex={0}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
              {sourceLabel(citation.sourceType)}
            </p>
            {relevance !== null ? (
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                {relevance}
              </p>
            ) : null}
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
            {citation.title}
          </p>
          <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {citation.snippet}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const label = messageKindLabel(message);
  const shouldRevealCitations =
    isAssistant && message.status === "done" && message.citations.length > 0;
  const citationsLabel = shouldRevealCitations
    ? `${message.citations.length} 条引用`
    : "引用待补充";
  const visibleCitations = message.citations.slice(0, 3);
  const hiddenCitationCount = Math.max(0, message.citations.length - visibleCitations.length);

  return (
    <article
      className={`min-w-0 overflow-hidden border-2 p-4 shadow-[4px_4px_0_#161616] ${
        isAssistant
          ? "border-foreground bg-card text-foreground"
          : "ml-auto max-w-[92%] border-foreground bg-[#161616] text-[#f7f2ea]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] opacity-70">
          <span>{isAssistant ? "分析助手" : "你"}</span>
          <span className="opacity-40">/</span>
          <span>{label}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 font-mono text-[0.66rem] uppercase tracking-[0.08em] opacity-60">
          <span>
            {message.status === "streaming"
              ? "生成中"
              : message.status === "error"
                ? "异常"
                : "完成"}
          </span>
          <span className="opacity-40">/</span>
          <span>{citationsLabel}</span>
        </div>
      </div>

      {isAssistant ? (
        <div className="prose prose-sm mt-3 max-w-none break-words [overflow-wrap:anywhere] prose-headings:mb-3 prose-headings:font-mono prose-headings:text-[1rem] prose-headings:uppercase prose-headings:tracking-[0.08em] prose-p:my-2 prose-p:text-foreground prose-strong:text-foreground prose-li:my-1 prose-li:text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || "正在基于简历与 JD 生成分析..."}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
          {message.content}
        </p>
      )}

      {shouldRevealCitations ? (
        <section className="mt-4 border-t border-foreground/15 pt-3">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
            引用依据 ({message.citations.length})
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {visibleCitations.map((citation) => (
              <CitationBadge key={citation.id} citation={citation} />
            ))}
            {hiddenCitationCount > 0 ? (
              <span className="inline-flex h-9 min-w-9 items-center justify-center border border-dashed border-foreground/30 bg-background px-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                +{hiddenCitationCount}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              悬停查看详情
            </span>
          </div>
        </section>
      ) : null}
    </article>
  );
}

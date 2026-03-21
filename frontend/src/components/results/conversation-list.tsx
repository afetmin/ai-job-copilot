"use client";

import type { ResumeReviewRecord } from "@/lib/resume-review-db";

type ConversationListProps = {
  reviews: ResumeReviewRecord[];
  activeReviewId: string | null;
  onSelect: (reviewId: string) => void;
};

function formatStatus(status: ResumeReviewRecord["analysisStatus"]): string {
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

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function ConversationList({
  reviews,
  activeReviewId,
  onSelect,
}: ConversationListProps) {
  const sortedReviews = [...reviews].sort((left, right) => {
    if (right.createdAt !== left.createdAt) {
      return right.createdAt - left.createdAt;
    }

    return right.updatedAt - left.updatedAt;
  });

  if (sortedReviews.length === 0) {
    return (
      <div className="border-2 border-dashed border-foreground/25 bg-background px-4 py-5 text-sm leading-6 text-muted-foreground">
        当前还没有可选对话，请先从工作台创建一次。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedReviews.map((review) => {
        const isActive = review.reviewId === activeReviewId;

        return (
          <button
            aria-pressed={isActive}
            key={review.reviewId}
            className={`w-full border-2 px-4 py-3 text-left shadow-[4px_4px_0_#161616] transition-colors ${
              isActive
                ? "border-foreground bg-[#161616] text-[#f7f2ea]"
                : "border-foreground bg-card text-foreground"
            }`}
            onClick={() => onSelect(review.reviewId)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.08em] opacity-70">
                  {review.targetRole ?? "未命名岗位"}
                </p>
                <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.08em] opacity-55">
                  {review.requestId}
                </p>
              </div>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.08em] opacity-60">
                {formatStatus(review.analysisStatus)}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[0.64rem] uppercase tracking-[0.08em] opacity-60">
              <span>{review.suggestionCount} Suggestions</span>
              <span className="text-right">{formatUpdatedAt(review.updatedAt)}</span>
            </div>

            <p className="mt-3 line-clamp-3 text-[0.84rem] leading-6 opacity-85">
              {review.resumePreview || review.jobDescriptionPreview || "暂无摘要内容。"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

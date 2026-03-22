"use client";

import { useEffect, useState } from "react";

import { RESUME_REVIEW_SESSION_STORAGE_KEY } from "@/components/workspace/resume-review-form";

export type PreparedResumeReviewResponse = {
  requestId: string;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
  suggestionCount: number;
  targetRole: string | null;
  resumePreview: string;
  jobDescriptionPreview: string;
  streamPayload: {
    resume_document_id: string;
    job_description_document_id: string;
    suggestion_count: number;
    target_role: string | null;
  };
};

export function isPreparedResumeReviewResponse(
  value: unknown,
  requestId: string,
): value is PreparedResumeReviewResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const streamPayload = payload.streamPayload;

  if (
    typeof payload.requestId !== "string" ||
    payload.requestId !== requestId ||
    typeof payload.resumeDocumentId !== "string" ||
    payload.resumeDocumentId.trim() === "" ||
    typeof payload.jobDescriptionDocumentId !== "string" ||
    payload.jobDescriptionDocumentId.trim() === "" ||
    typeof payload.suggestionCount !== "number" ||
    !Number.isInteger(payload.suggestionCount) ||
    payload.suggestionCount < 1 ||
    payload.suggestionCount > 20 ||
    !(typeof payload.targetRole === "string" || payload.targetRole === null) ||
    typeof payload.resumePreview !== "string" ||
    payload.resumePreview.trim() === "" ||
    typeof payload.jobDescriptionPreview !== "string" ||
    payload.jobDescriptionPreview.trim() === ""
  ) {
    return false;
  }

  if (typeof streamPayload !== "object" || streamPayload === null) {
    return false;
  }

  const stream = streamPayload as Record<string, unknown>;
  return (
    typeof stream.resume_document_id === "string" &&
    stream.resume_document_id.trim() !== "" &&
    typeof stream.job_description_document_id === "string" &&
    stream.job_description_document_id.trim() !== "" &&
    typeof stream.suggestion_count === "number" &&
    Number.isInteger(stream.suggestion_count) &&
    stream.suggestion_count >= 1 &&
    stream.suggestion_count <= 20 &&
    (typeof stream.target_role === "string" || stream.target_role === null)
  );
}

export function readPreparedRequest(
  requestId: string,
): PreparedResumeReviewResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawPayload = window.sessionStorage.getItem(RESUME_REVIEW_SESSION_STORAGE_KEY);
  if (rawPayload === null) {
    return null;
  }

  try {
    const parsedPayload: unknown = JSON.parse(rawPayload);
    return isPreparedResumeReviewResponse(parsedPayload, requestId) ? parsedPayload : null;
  } catch {
    return null;
  }
}

type PreparedReviewProps = {
  requestId: string;
};

export function PreparedReview({ requestId }: PreparedReviewProps) {
  const [preparedRequest, setPreparedRequest] = useState<PreparedResumeReviewResponse | null>(
    null,
  );

  useEffect(() => {
    setPreparedRequest(readPreparedRequest(requestId));
  }, [requestId]);

  if (preparedRequest === null) {
    return (
      <div className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] p-5 text-sm leading-6 text-muted-foreground shadow-[4px_4px_0_#161616]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
          已准备分析请求
        </p>
        <p className="mt-3">暂无可展示的准备请求，请先从工作台提交一次。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
          请求 ID
        </p>
        <p className="mt-2 break-all text-sm leading-6 text-foreground">
          {preparedRequest.requestId}
        </p>
      </div>
      <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
          简历摘要
        </p>
        <p className="mt-2 break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
          {preparedRequest.resumePreview}
        </p>
      </div>
      <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
          JD 摘要
        </p>
        <p className="mt-2 break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
          {preparedRequest.jobDescriptionPreview}
        </p>
      </div>
    </div>
  );
}

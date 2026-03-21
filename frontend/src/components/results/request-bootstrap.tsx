"use client";

import { useEffect, useState } from "react";

import { INTERVIEW_PACK_SESSION_STORAGE_KEY } from "@/components/workspace/interview-pack-form";

type PreparedInterviewPackResponse = {
  requestId: string;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
};

function isPreparedInterviewPackResponse(
  value: unknown,
  requestId: string,
): value is PreparedInterviewPackResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  if (
    typeof payload.requestId !== "string" ||
    payload.requestId !== requestId ||
    typeof payload.resumeDocumentId !== "string" ||
    payload.resumeDocumentId.trim() === "" ||
    typeof payload.jobDescriptionDocumentId !== "string" ||
    payload.jobDescriptionDocumentId.trim() === ""
  ) {
    return false;
  }

  return true;
}

function readPreparedRequest(requestId: string): PreparedInterviewPackResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawPayload = window.sessionStorage.getItem(INTERVIEW_PACK_SESSION_STORAGE_KEY);
  if (rawPayload === null) {
    return null;
  }

  try {
    const parsedPayload: unknown = JSON.parse(rawPayload);
    return isPreparedInterviewPackResponse(parsedPayload, requestId) ? parsedPayload : null;
  } catch {
    return null;
  }
}

type RequestBootstrapProps = {
  requestId: string;
};

export function RequestBootstrap({ requestId }: RequestBootstrapProps) {
  const [preparedRequest, setPreparedRequest] = useState<PreparedInterviewPackResponse | null>(
    null,
  );

  useEffect(() => {
    setPreparedRequest(readPreparedRequest(requestId));
  }, [requestId]);

  if (preparedRequest === null) {
    return (
      <div className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] p-5 text-sm leading-6 text-muted-foreground shadow-[4px_4px_0_#161616]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
          已准备请求
        </p>
        <p className="mt-3">
          暂无可展示的准备请求，请先从工作台提交一次。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] p-5 shadow-[4px_4px_0_#161616]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
          已准备请求
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          这份请求来自 sessionStorage，并且与当前结果页的请求 ID 匹配。
        </p>
      </div>

      <dl className="grid gap-3">
        <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
          <dt className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
            请求 ID
          </dt>
          <dd className="mt-2 break-all text-sm leading-6 text-foreground">
            {preparedRequest.requestId}
          </dd>
        </div>
        <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
          <dt className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
            简历文档 ID
          </dt>
          <dd className="mt-2 break-all text-sm leading-6 text-foreground">
            {preparedRequest.resumeDocumentId}
          </dd>
        </div>
        <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
          <dt className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
            岗位描述文档 ID
          </dt>
          <dd className="mt-2 break-all text-sm leading-6 text-foreground">
            {preparedRequest.jobDescriptionDocumentId}
          </dd>
        </div>
      </dl>
    </div>
  );
}

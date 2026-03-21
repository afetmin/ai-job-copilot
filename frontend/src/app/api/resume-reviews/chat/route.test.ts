import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createResumeReviewAccessCookie,
  parseResumeReviewAccessCookie,
  RESUME_REVIEW_ACCESS_COOKIE_NAME,
} from "@/lib/resume-review-access";

import { POST } from "./route";

function createSseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
}

describe("POST /api/resume-reviews/chat", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("consumes one free analysis and proxies the upstream SSE stream when local model settings are absent", async () => {
    fetchMock.mockResolvedValueOnce(
      createSseResponse('event: start\ndata: {"review_id":"pack-123"}\n\n'),
    );

    const response = await POST(
      new Request("http://localhost/api/resume-reviews/chat", {
        method: "POST",
        headers: {
          cookie: `${RESUME_REVIEW_ACCESS_COOKIE_NAME}=${createResumeReviewAccessCookie(2)}`,
        },
        body: JSON.stringify({
          reviewId: "pack-123",
          requestId: "req-123",
          resumeDocumentId: "resume-001",
          jobDescriptionDocumentId: "jd-001",
          suggestionCount: 5,
          targetRole: "Backend Engineer",
          messages: [
            { role: "system", content: "你是资深求职教练。" },
            { role: "user", content: "先给我整体分析。" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("event: start");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      review_id: "pack-123",
      request_id: "req-123",
      resume_document_id: "resume-001",
      job_description_document_id: "jd-001",
      suggestion_count: 5,
      target_role: "Backend Engineer",
      messages: [
        { role: "system", content: "你是资深求职教练。" },
        { role: "user", content: "先给我整体分析。" },
      ],
      runtime_model_config: null,
    });

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(RESUME_REVIEW_ACCESS_COOKIE_NAME);
    const rawCookieValue = setCookie?.match(
      new RegExp(`${RESUME_REVIEW_ACCESS_COOKIE_NAME}=([^;]+)`),
    )?.[1] ?? null;
    expect(parseResumeReviewAccessCookie(rawCookieValue)?.remainingFreeAnalyses).toBe(1);
  });

  it("uses local model settings without consuming free quota", async () => {
    fetchMock.mockResolvedValueOnce(
      createSseResponse('event: done\ndata: {"review_id":"pack-123"}\n\n'),
    );

    const response = await POST(
      new Request("http://localhost/api/resume-reviews/chat", {
        method: "POST",
        body: JSON.stringify({
          reviewId: "pack-123",
          requestId: "req-123",
          resumeDocumentId: "resume-001",
          jobDescriptionDocumentId: "jd-001",
          suggestionCount: 5,
          targetRole: "Backend Engineer",
          messages: [{ role: "user", content: "请重点改写项目经历。" }],
          localModelSettings: {
            provider: "dashscope",
            apiKey: "user-key",
            model: "qwen-max",
            baseUrl: "https://runtime.example/v1",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      review_id: "pack-123",
      request_id: "req-123",
      resume_document_id: "resume-001",
      job_description_document_id: "jd-001",
      suggestion_count: 5,
      target_role: "Backend Engineer",
      messages: [{ role: "user", content: "请重点改写项目经历。" }],
      runtime_model_config: {
        provider: "dashscope",
        api_key: "user-key",
        model: "qwen-max",
        base_url: "https://runtime.example/v1",
      },
    });
  });

  it("returns 403 when quota is exhausted and no local model settings are present", async () => {
    const response = await POST(
      new Request("http://localhost/api/resume-reviews/chat", {
        method: "POST",
        headers: {
          cookie: `${RESUME_REVIEW_ACCESS_COOKIE_NAME}=${createResumeReviewAccessCookie(0)}`,
        },
        body: JSON.stringify({
          reviewId: "pack-123",
          resumeDocumentId: "resume-001",
          jobDescriptionDocumentId: "jd-001",
          suggestionCount: 5,
          messages: [{ role: "user", content: "先给我整体分析。" }],
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

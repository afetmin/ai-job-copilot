import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RESUME_REVIEW_ACCESS_COOKIE_NAME,
} from "@/lib/resume-review-access";
import {
  createResumeReviewAccessCookie,
  parseResumeReviewAccessCookie,
} from "@/lib/resume-review-access-cookie";

import { POST } from "./route";

function createSseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
}

describe("POST /api/resume-reviews/analysis", () => {
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
      new Request("http://localhost/api/resume-reviews/analysis", {
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
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain('event: start');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      review_id: "pack-123",
      request_id: "req-123",
      resume_document_id: "resume-001",
      job_description_document_id: "jd-001",
      suggestion_count: 5,
      target_role: "Backend Engineer",
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
      new Request("http://localhost/api/resume-reviews/analysis", {
        method: "POST",
        body: JSON.stringify({
          reviewId: "pack-123",
          requestId: "req-123",
          resumeDocumentId: "resume-001",
          jobDescriptionDocumentId: "jd-001",
          suggestionCount: 5,
          targetRole: "Backend Engineer",
          localModelSettings: {
            protocol: "anthropic_compatible",
            apiKey: "user-key",
            model: "claude-sonnet-4-5",
            baseUrl: "https://runtime.example",
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
      runtime_model_config: {
        protocol: "anthropic_compatible",
        api_key: "user-key",
        model: "claude-sonnet-4-5",
        base_url: "https://runtime.example",
      },
    });
  });

  it("treats malformed local model settings as absent instead of throwing", async () => {
    const response = await POST(
      new Request("http://localhost/api/resume-reviews/analysis", {
        method: "POST",
        headers: {
          cookie: `${RESUME_REVIEW_ACCESS_COOKIE_NAME}=${createResumeReviewAccessCookie(0)}`,
        },
        body: JSON.stringify({
          reviewId: "pack-123",
          requestId: "req-123",
          resumeDocumentId: "resume-001",
          jobDescriptionDocumentId: "jd-001",
          suggestionCount: 5,
          localModelSettings: {
            protocol: 123,
            apiKey: null,
            model: "",
          },
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

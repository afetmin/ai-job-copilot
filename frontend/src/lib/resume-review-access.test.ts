import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  buildResumeReviewAccessResponse,
  fetchResumeReviewAccessStatus,
  shouldBlockResumeReviewCreation,
} from "./resume-review-access";
import {
  createResumeReviewAccessCookie,
  parseResumeReviewAccessCookie,
} from "./resume-review-access-cookie";

describe("resume-review-access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("round-trips signed access cookies", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-21T00:00:00.000Z"));

      const cookieValue = createResumeReviewAccessCookie(1);
      const parsedCookie = parseResumeReviewAccessCookie(cookieValue);

      expect(parsedCookie).toEqual({
        version: 1,
        remainingFreeAnalyses: 1,
        issuedAt: new Date("2026-03-21T00:00:00.000Z").getTime(),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects tampered cookies", () => {
    const cookieValue = createResumeReviewAccessCookie(2);
    expect(parseResumeReviewAccessCookie(`${cookieValue}tamper`)).toBeNull();
  });

  it("requires explicit cookie secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_JOB_COPILOT_ACCESS_COOKIE_SECRET", "");

    expect(() => createResumeReviewAccessCookie(1)).toThrow(
      "AI_JOB_COPILOT_ACCESS_COOKIE_SECRET must be set in production",
    );
  });

  it("blocks only when free quota is exhausted and no local provider settings exist", () => {
    expect(
      shouldBlockResumeReviewCreation({
        remainingFreeAnalyses: 0,
        requiresUserModelConfig: true,
        hasLocalProviderSettings: false,
      }),
    ).toBe(true);

    expect(
      shouldBlockResumeReviewCreation({
        remainingFreeAnalyses: 0,
        requiresUserModelConfig: false,
        hasLocalProviderSettings: true,
      }),
    ).toBe(false);

    expect(buildResumeReviewAccessResponse(10)).toEqual({
      remainingFreeAnalyses: 10,
      requiresUserModelConfig: false,
    });
  });

  it("falls back to the configured default quota when the response payload is malformed", async () => {
    vi.stubEnv("AI_JOB_COPILOT_RESUME_REVIEW_FREE_ANALYSES", "14");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ remainingFreeAnalyses: "bad-value" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    );

    await expect(fetchResumeReviewAccessStatus()).resolves.toEqual({
      remainingFreeAnalyses: 14,
      requiresUserModelConfig: false,
    });
  });
});

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  buildResumeReviewAccessResponse,
  shouldBlockResumeReviewCreation,
} from "./resume-review-access";
import {
  createResumeReviewAccessCookie,
  parseResumeReviewAccessCookie,
} from "./resume-review-access-cookie";

describe("resume-review-access", () => {
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

    expect(buildResumeReviewAccessResponse(2)).toEqual({
      remainingFreeAnalyses: 2,
      requiresUserModelConfig: false,
    });
  });
});

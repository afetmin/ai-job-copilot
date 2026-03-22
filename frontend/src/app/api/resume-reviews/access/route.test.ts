import { afterEach, describe, expect, it, vi } from "vitest";

import { RESUME_REVIEW_ACCESS_COOKIE_NAME } from "@/lib/resume-review-access";
import { createResumeReviewAccessCookie } from "@/lib/resume-review-access-cookie";

import { GET } from "./route";

describe("GET /api/resume-reviews/access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the default quota and seeds a signed cookie when missing", async () => {
    const response = await GET(
      new Request("http://localhost/api/resume-reviews/access"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      remainingFreeAnalyses: 10,
      requiresUserModelConfig: false,
    });
    expect(response.headers.get("set-cookie")).toContain(RESUME_REVIEW_ACCESS_COOKIE_NAME);
  });

  it("reads the configured default quota from the environment", async () => {
    vi.stubEnv("AI_JOB_COPILOT_RESUME_REVIEW_FREE_ANALYSES", "12");

    const response = await GET(
      new Request("http://localhost/api/resume-reviews/access"),
    );

    expect(await response.json()).toEqual({
      remainingFreeAnalyses: 12,
      requiresUserModelConfig: false,
    });
  });

  it("reads an existing signed cookie without rewriting it", async () => {
    const cookieValue = createResumeReviewAccessCookie(0);
    const response = await GET(
      new Request("http://localhost/api/resume-reviews/access", {
        headers: {
          cookie: `${RESUME_REVIEW_ACCESS_COOKIE_NAME}=${cookieValue}`,
        },
      }),
    );

    expect(await response.json()).toEqual({
      remainingFreeAnalyses: 0,
      requiresUserModelConfig: false,
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

import { createHmac } from "node:crypto";

import {
  RESUME_REVIEW_ACCESS_COOKIE_NAME,
} from "@/lib/resume-review-access";
import { getDefaultResumeReviewFreeAnalyses } from "@/lib/env";

const RESUME_REVIEW_ACCESS_COOKIE_VERSION = 1;
const DEFAULT_RESUME_REVIEW_ACCESS_COOKIE_SECRET =
  "ai-job-copilot-resume-review-access-secret";

type ResumeReviewAccessCookiePayload = {
  version: typeof RESUME_REVIEW_ACCESS_COOKIE_VERSION;
  remainingFreeAnalyses: number;
  issuedAt: number;
};

function base64UrlEncode(rawValue: string): string {
  return Buffer.from(rawValue, "utf8").toString("base64url");
}

function base64UrlDecode(rawValue: string): string {
  return Buffer.from(rawValue, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getResumeReviewAccessCookieSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function getResumeReviewAccessCookieSecret(): string {
  const secret = process.env.AI_JOB_COPILOT_ACCESS_COOKIE_SECRET;
  if (typeof secret === "string" && secret.trim() !== "") {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AI_JOB_COPILOT_ACCESS_COOKIE_SECRET must be set in production");
  }

  return DEFAULT_RESUME_REVIEW_ACCESS_COOKIE_SECRET;
}

function normalizeRemainingFreeAnalyses(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return getDefaultResumeReviewFreeAnalyses();
  }

  return value;
}

export function serializeResumeReviewAccessCookie(
  payload: ResumeReviewAccessCookiePayload,
): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `v${RESUME_REVIEW_ACCESS_COOKIE_VERSION}.${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function parseResumeReviewAccessCookie(
  rawValue: string | null,
): ResumeReviewAccessCookiePayload | null {
  if (rawValue === null || rawValue.trim() === "") {
    return null;
  }

  const [versionPart, encodedPayload, signature] = rawValue.split(".");
  if (
    versionPart !== `v${RESUME_REVIEW_ACCESS_COOKIE_VERSION}` ||
    typeof encodedPayload !== "string" ||
    encodedPayload === "" ||
    typeof signature !== "string" ||
    signature === ""
  ) {
    return null;
  }

  if (signPayload(encodedPayload) !== signature) {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as Partial<ResumeReviewAccessCookiePayload>;
    if (
      decodedPayload.version !== RESUME_REVIEW_ACCESS_COOKIE_VERSION ||
      typeof decodedPayload.issuedAt !== "number" ||
      !Number.isFinite(decodedPayload.issuedAt)
    ) {
      return null;
    }

    return {
      version: RESUME_REVIEW_ACCESS_COOKIE_VERSION,
      remainingFreeAnalyses: normalizeRemainingFreeAnalyses(
        decodedPayload.remainingFreeAnalyses,
      ),
      issuedAt: decodedPayload.issuedAt,
    };
  } catch {
    return null;
  }
}

export function createResumeReviewAccessCookie(
  remainingFreeAnalyses = getDefaultResumeReviewFreeAnalyses(),
): string {
  return serializeResumeReviewAccessCookie({
    version: RESUME_REVIEW_ACCESS_COOKIE_VERSION,
    remainingFreeAnalyses,
    issuedAt: Date.now(),
  });
}

export function createResumeReviewAccessCookieHeader(
  remainingFreeAnalyses = getDefaultResumeReviewFreeAnalyses(),
): {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    name: RESUME_REVIEW_ACCESS_COOKIE_NAME,
    value: createResumeReviewAccessCookie(remainingFreeAnalyses),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

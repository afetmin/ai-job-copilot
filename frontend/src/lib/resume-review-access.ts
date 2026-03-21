import { createHmac } from "node:crypto";

import { getProviderSettings } from "@/lib/resume-review-db";

export const RESUME_REVIEW_ACCESS_COOKIE_NAME =
  "ai-job-copilot-resume-review-access";
export const DEFAULT_RESUME_REVIEW_FREE_ANALYSES = 2;
const RESUME_REVIEW_ACCESS_COOKIE_VERSION = 1;
const RESUME_REVIEW_ACCESS_COOKIE_SECRET =
  process.env.AI_JOB_COPILOT_ACCESS_COOKIE_SECRET ??
  "ai-job-copilot-resume-review-access-secret";

type ResumeReviewAccessCookiePayload = {
  version: typeof RESUME_REVIEW_ACCESS_COOKIE_VERSION;
  remainingFreeAnalyses: number;
  issuedAt: number;
};

export type ResumeReviewAccessResponse = {
  remainingFreeAnalyses: number;
  requiresUserModelConfig: boolean;
};

export type ResumeReviewAccessGate = ResumeReviewAccessResponse & {
  hasLocalProviderSettings: boolean;
};

function base64UrlEncode(rawValue: string): string {
  return Buffer.from(rawValue, "utf8").toString("base64url");
}

function base64UrlDecode(rawValue: string): string {
  return Buffer.from(rawValue, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", RESUME_REVIEW_ACCESS_COOKIE_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function normalizeRemainingFreeAnalyses(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return DEFAULT_RESUME_REVIEW_FREE_ANALYSES;
  }

  return value;
}

export function buildResumeReviewAccessResponse(
  remainingFreeAnalyses: number,
): ResumeReviewAccessResponse {
  return {
    remainingFreeAnalyses: normalizeRemainingFreeAnalyses(remainingFreeAnalyses),
    requiresUserModelConfig: false,
  };
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
  remainingFreeAnalyses = DEFAULT_RESUME_REVIEW_FREE_ANALYSES,
): string {
  return serializeResumeReviewAccessCookie({
    version: RESUME_REVIEW_ACCESS_COOKIE_VERSION,
    remainingFreeAnalyses,
    issuedAt: Date.now(),
  });
}

export async function fetchResumeReviewAccessStatus(): Promise<ResumeReviewAccessResponse> {
  const response = await fetch("/api/resume-reviews/access", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("failed to load resume review access status");
  }

  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("failed to load resume review access status");
  }

  const candidate = payload as Record<string, unknown>;
  return buildResumeReviewAccessResponse(
    typeof candidate.remainingFreeAnalyses === "number"
      ? candidate.remainingFreeAnalyses
      : DEFAULT_RESUME_REVIEW_FREE_ANALYSES,
  );
}

export async function resolveResumeReviewAccessGate(): Promise<ResumeReviewAccessGate> {
  const [status, providerSettings] = await Promise.all([
    fetchResumeReviewAccessStatus(),
    getProviderSettings(),
  ]);

  const hasLocalProviderSettings = providerSettings !== null;
  return {
    ...status,
    requiresUserModelConfig:
      status.remainingFreeAnalyses <= 0 && !hasLocalProviderSettings,
    hasLocalProviderSettings,
  };
}

export function shouldBlockResumeReviewCreation(gate: ResumeReviewAccessGate): boolean {
  return gate.remainingFreeAnalyses <= 0 && !gate.hasLocalProviderSettings;
}

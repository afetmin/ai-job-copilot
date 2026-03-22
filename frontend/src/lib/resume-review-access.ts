import { getDefaultResumeReviewFreeAnalyses } from "@/lib/env";
import { getProviderSettings } from "@/lib/resume-review-db";

export const RESUME_REVIEW_ACCESS_COOKIE_NAME =
  "ai-job-copilot-resume-review-access";

export type ResumeReviewAccessResponse = {
  remainingFreeAnalyses: number;
  requiresUserModelConfig: boolean;
};

export type ResumeReviewAccessGate = ResumeReviewAccessResponse & {
  hasLocalProviderSettings: boolean;
};

function normalizeRemainingFreeAnalyses(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return getDefaultResumeReviewFreeAnalyses();
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
      : getDefaultResumeReviewFreeAnalyses(),
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

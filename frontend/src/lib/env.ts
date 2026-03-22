const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_RESUME_REVIEW_FREE_ANALYSES = 10;
const RESUME_REVIEW_FREE_ANALYSES_ENV_NAME =
  "AI_JOB_COPILOT_RESUME_REVIEW_FREE_ANALYSES";

function parsePositiveIntegerEnv(
  rawValue: string | undefined,
  fallback: number,
): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? DEFAULT_BACKEND_URL;
}

export function getDefaultResumeReviewFreeAnalyses(): number {
  return parsePositiveIntegerEnv(
    process.env[RESUME_REVIEW_FREE_ANALYSES_ENV_NAME],
    DEFAULT_RESUME_REVIEW_FREE_ANALYSES,
  );
}

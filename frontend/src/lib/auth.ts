export const SESSION_COOKIE_NAME = "ai-job-copilot-session";

export function createSessionToken(): string {
  return "workspace-access";
}

export function isValidSessionToken(candidateToken: string | undefined): boolean {
  return Boolean(candidateToken);
}

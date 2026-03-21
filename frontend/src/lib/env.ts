const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? DEFAULT_BACKEND_URL;
}

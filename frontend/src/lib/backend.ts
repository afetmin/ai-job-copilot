import { getBackendBaseUrl } from "@/lib/env";

export function getResumeReviewSuggestionsStreamEndpoint(): string {
  return `${getBackendBaseUrl()}/api/resume-reviews/suggestions/stream`;
}

export function getResumeReviewAnalysisStreamEndpoint(): string {
  return `${getBackendBaseUrl()}/api/resume-reviews/analysis/stream`;
}

export function getDocumentTextIngestEndpoint(): string {
  return `${getBackendBaseUrl()}/api/documents/ingest-text`;
}

export function getDocumentFileIngestEndpoint(): string {
  return `${getBackendBaseUrl()}/api/documents/ingest-file`;
}

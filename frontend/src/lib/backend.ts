import { getBackendBaseUrl } from "@/lib/env";

export function getInterviewStreamEndpoint(): string {
  return `${getBackendBaseUrl()}/api/interview-packs/stream`;
}

export function getDocumentTextIngestEndpoint(): string {
  return `${getBackendBaseUrl()}/api/documents/ingest-text`;
}

export function getDocumentFileIngestEndpoint(): string {
  return `${getBackendBaseUrl()}/api/documents/ingest-file`;
}

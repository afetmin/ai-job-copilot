import Dexie, { type Table } from "dexie";

export const RESUME_REVIEW_DB_NAME = "ai-job-copilot-resume-review-db";
export const RESUME_REVIEW_PROVIDER_SETTINGS_ID = "current";

export type ProviderSettingsInput = {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
};

export type ProviderSettingsRecord = {
  id: typeof RESUME_REVIEW_PROVIDER_SETTINGS_ID;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ResumeReviewCitation = {
  id: string;
  sourceType: "resume" | "job_description";
  title: string;
  snippet: string;
  score?: number;
};

export type ResumeReviewRecord = {
  reviewId: string;
  requestId: string;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
  suggestionCount: number;
  targetRole: string | null;
  resumePreview: string;
  jobDescriptionPreview: string;
  analysisStatus: "pending" | "streaming" | "completed" | "error";
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
};

export type ResumeReviewInput = {
  reviewId: string;
  requestId: string;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
  suggestionCount: number;
  targetRole: string | null;
  resumePreview: string;
  jobDescriptionPreview: string;
  analysisStatus?: "pending" | "streaming" | "completed" | "error";
  createdAt?: number;
  updatedAt?: number;
  lastOpenedAt?: number | null;
};

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageStatus = "streaming" | "done" | "error";
export type ChatMessageKind = "initial_analysis" | "follow_up" | "system";

export type ChatMessageRecord = {
  messageId: string;
  reviewId: string;
  role: ChatMessageRole;
  kind: ChatMessageKind;
  content: string;
  status: ChatMessageStatus;
  citations: ResumeReviewCitation[];
  createdAt: number;
  updatedAt: number;
};

export type ChatMessageInput = {
  messageId: string;
  reviewId: string;
  role: ChatMessageRole;
  kind: ChatMessageKind;
  content: string;
  status: ChatMessageStatus;
  citations?: ResumeReviewCitation[];
  createdAt?: number;
  updatedAt?: number;
};

class ResumeReviewDatabase extends Dexie {
  provider_settings!: Table<ProviderSettingsRecord, typeof RESUME_REVIEW_PROVIDER_SETTINGS_ID>;
  resume_reviews!: Table<ResumeReviewRecord, string>;
  chat_messages!: Table<ChatMessageRecord, string>;

  constructor() {
    super(RESUME_REVIEW_DB_NAME);
    this.version(1).stores({
      provider_settings: "id, updatedAt",
      resume_reviews: "reviewId, requestId, updatedAt, createdAt",
      chat_messages: "messageId, reviewId, updatedAt, createdAt, [reviewId+createdAt]",
    });
    this.version(2).stores({
      provider_settings: "id, updatedAt",
      resume_reviews: "reviewId, requestId, updatedAt, createdAt, lastOpenedAt, analysisStatus",
      chat_messages: "messageId, reviewId, updatedAt, createdAt, [reviewId+createdAt]",
    });
  }
}

export const resumeReviewDatabase = new ResumeReviewDatabase();

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeRequiredText(value: string): string {
  return value.trim();
}

function now(): number {
  return Date.now();
}

export async function clearResumeReviewDatabase(): Promise<void> {
  await Promise.all([
    resumeReviewDatabase.provider_settings.clear(),
    resumeReviewDatabase.resume_reviews.clear(),
    resumeReviewDatabase.chat_messages.clear(),
  ]);
}

export async function saveProviderSettings(
  input: ProviderSettingsInput,
): Promise<ProviderSettingsRecord> {
  const existing = await resumeReviewDatabase.provider_settings.get(
    RESUME_REVIEW_PROVIDER_SETTINGS_ID,
  );
  const record: ProviderSettingsRecord = {
    id: RESUME_REVIEW_PROVIDER_SETTINGS_ID,
    provider: normalizeRequiredText(input.provider),
    apiKey: normalizeRequiredText(input.apiKey),
    model: normalizeRequiredText(input.model),
    baseUrl: normalizeOptionalText(input.baseUrl),
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };

  await resumeReviewDatabase.provider_settings.put(record);
  return record;
}

export async function getProviderSettings(): Promise<ProviderSettingsRecord | null> {
  return (
    (await resumeReviewDatabase.provider_settings.get(
      RESUME_REVIEW_PROVIDER_SETTINGS_ID,
    )) ?? null
  );
}

export async function upsertResumeReview(input: ResumeReviewInput): Promise<ResumeReviewRecord> {
  const existing = await resumeReviewDatabase.resume_reviews.get(input.reviewId);
  const record: ResumeReviewRecord = {
    reviewId: normalizeRequiredText(input.reviewId),
    requestId: normalizeRequiredText(input.requestId),
    resumeDocumentId: normalizeRequiredText(input.resumeDocumentId),
    jobDescriptionDocumentId: normalizeRequiredText(input.jobDescriptionDocumentId),
    suggestionCount: input.suggestionCount,
    targetRole: normalizeOptionalText(input.targetRole),
    resumePreview: normalizeRequiredText(input.resumePreview),
    jobDescriptionPreview: normalizeRequiredText(input.jobDescriptionPreview),
    analysisStatus: input.analysisStatus ?? existing?.analysisStatus ?? "pending",
    createdAt: input.createdAt ?? existing?.createdAt ?? now(),
    updatedAt: input.updatedAt ?? now(),
    lastOpenedAt: input.lastOpenedAt ?? existing?.lastOpenedAt ?? null,
  };

  await resumeReviewDatabase.resume_reviews.put(record);
  return record;
}

export async function listResumeReviews(): Promise<ResumeReviewRecord[]> {
  return resumeReviewDatabase.resume_reviews.orderBy("updatedAt").reverse().toArray();
}

export async function deleteResumeReview(reviewId: string): Promise<void> {
  await resumeReviewDatabase.transaction(
    "rw",
    resumeReviewDatabase.resume_reviews,
    resumeReviewDatabase.chat_messages,
    async () => {
      await resumeReviewDatabase.resume_reviews.delete(reviewId);
      await resumeReviewDatabase.chat_messages.where("reviewId").equals(reviewId).delete();
    },
  );
}

export async function upsertChatMessage(input: ChatMessageInput): Promise<ChatMessageRecord> {
  const existing = await resumeReviewDatabase.chat_messages.get(input.messageId);
  const record: ChatMessageRecord = {
    messageId: normalizeRequiredText(input.messageId),
    reviewId: normalizeRequiredText(input.reviewId),
    role: input.role,
    kind: input.kind,
    content: input.content,
    status: input.status,
    citations: input.citations ?? [],
    createdAt: input.createdAt ?? existing?.createdAt ?? now(),
    updatedAt: input.updatedAt ?? now(),
  };

  await resumeReviewDatabase.chat_messages.put(record);
  return record;
}

export async function listMessagesForReview(reviewId: string): Promise<ChatMessageRecord[]> {
  return resumeReviewDatabase.chat_messages.where("reviewId").equals(reviewId).sortBy("createdAt");
}

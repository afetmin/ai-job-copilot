import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  clearResumeReviewDatabase,
  getProviderSettings,
  listResumeReviews,
  listMessagesForReview,
  saveProviderSettings,
  upsertChatMessage,
  upsertResumeReview,
} from "./resume-review-db";

afterEach(async () => {
  await clearResumeReviewDatabase();
});

describe("resume-review-db", () => {
  it("saves and loads provider settings", async () => {
    const savedSettings = await saveProviderSettings({
      provider: "openai",
      apiKey: "sk-test-123",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
    });

    expect(savedSettings.id).toBe("current");
    expect(await getProviderSettings()).toEqual(savedSettings);
  });

  it("returns resume reviews in reverse updatedAt order", async () => {
    await upsertResumeReview({
      reviewId: "pack-1",
      requestId: "req-1",
      resumeDocumentId: "resume-1",
      jobDescriptionDocumentId: "jd-1",
      suggestionCount: 5,
      targetRole: "Backend Engineer",
      resumePreview: "resume preview 1",
      jobDescriptionPreview: "jd preview 1",
      createdAt: 10,
      updatedAt: 10,
    });

    await upsertResumeReview({
      reviewId: "pack-2",
      requestId: "req-2",
      resumeDocumentId: "resume-2",
      jobDescriptionDocumentId: "jd-2",
      suggestionCount: 3,
      targetRole: null,
      resumePreview: "resume preview 2",
      jobDescriptionPreview: "jd preview 2",
      createdAt: 20,
      updatedAt: 20,
    });

    expect((await listResumeReviews()).map((review) => review.reviewId)).toEqual([
      "pack-2",
      "pack-1",
    ]);
  });

  it("queries chat messages by reviewId", async () => {
    await upsertChatMessage({
      messageId: "msg-1",
      reviewId: "pack-1",
      role: "assistant",
      kind: "initial_analysis",
      content: "first",
      status: "done",
      citations: [],
      createdAt: 10,
      updatedAt: 10,
    });

    await upsertChatMessage({
      messageId: "msg-2",
      reviewId: "pack-2",
      role: "assistant",
      kind: "follow_up",
      content: "second",
      status: "done",
      citations: [],
      createdAt: 20,
      updatedAt: 20,
    });

    await upsertChatMessage({
      messageId: "msg-3",
      reviewId: "pack-1",
      role: "user",
      kind: "follow_up",
      content: "third",
      status: "done",
      citations: [],
      createdAt: 30,
      updatedAt: 30,
    });

    expect((await listMessagesForReview("pack-1")).map((message) => message.messageId)).toEqual([
      "msg-1",
      "msg-3",
    ]);
  });
});

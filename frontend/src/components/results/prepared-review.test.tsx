import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RESUME_REVIEW_SESSION_STORAGE_KEY,
} from "@/components/workspace/resume-review-form";

import { PreparedReview } from "./prepared-review";

describe("PreparedReview", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("renders the prepared request metadata when it matches the current request", async () => {
    window.sessionStorage.setItem(
      RESUME_REVIEW_SESSION_STORAGE_KEY,
      JSON.stringify({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        suggestionCount: 5,
        targetRole: "Backend Engineer",
        resumePreview: "resume preview 1",
        jobDescriptionPreview: "jd preview 1",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          suggestion_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    render(<PreparedReview requestId="req-test-123" />);

    expect(await screen.findByText("req-test-123")).toBeInTheDocument();
    expect(screen.getByText("resume preview 1")).toBeInTheDocument();
    expect(screen.getByText("jd preview 1")).toBeInTheDocument();
    expect(screen.getByText("resume preview 1").className).toContain("break-words");
    expect(screen.getByText("jd preview 1").className).toContain("break-words");
  });

  it("falls back when the stored request does not match the current request", async () => {
    window.sessionStorage.setItem(
      RESUME_REVIEW_SESSION_STORAGE_KEY,
      JSON.stringify({
        requestId: "req-other-999",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        suggestionCount: 5,
        targetRole: "Backend Engineer",
        resumePreview: "resume preview 1",
        jobDescriptionPreview: "jd preview 1",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          suggestion_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    render(<PreparedReview requestId="req-test-123" />);

    expect(
      await screen.findByText("暂无可展示的准备请求，请先从工作台提交一次。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("resume preview 1")).not.toBeInTheDocument();
    expect(screen.queryByText("jd preview 1")).not.toBeInTheDocument();
  });

  it("shows a fallback message when no prepared request is stored", async () => {
    render(<PreparedReview requestId="req-test-123" />);

    expect(
      await screen.findByText("暂无可展示的准备请求，请先从工作台提交一次。"),
    ).toBeInTheDocument();
  });
});

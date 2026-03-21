import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  INTERVIEW_PACK_SESSION_STORAGE_KEY,
} from "@/components/workspace/interview-pack-form";

import { RequestBootstrap } from "./request-bootstrap";

describe("RequestBootstrap", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("renders the prepared request metadata when it matches the current request", async () => {
    window.sessionStorage.setItem(
      INTERVIEW_PACK_SESSION_STORAGE_KEY,
      JSON.stringify({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
      }),
    );

    render(<RequestBootstrap requestId="req-test-123" />);

    expect(await screen.findByText("req-test-123")).toBeInTheDocument();
    expect(screen.getByText("resume-doc-1")).toBeInTheDocument();
    expect(screen.getByText("jd-doc-1")).toBeInTheDocument();
  });

  it("falls back when the stored request does not match the current request", async () => {
    window.sessionStorage.setItem(
      INTERVIEW_PACK_SESSION_STORAGE_KEY,
      JSON.stringify({
        requestId: "req-other-999",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
      }),
    );

    render(<RequestBootstrap requestId="req-test-123" />);

    expect(
      await screen.findByText("暂无可展示的准备请求，请先从工作台提交一次。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("resume-doc-1")).not.toBeInTheDocument();
    expect(screen.queryByText("jd-doc-1")).not.toBeInTheDocument();
  });

  it("shows a fallback message when no prepared request is stored", async () => {
    render(<RequestBootstrap requestId="req-test-123" />);

    expect(
      await screen.findByText("暂无可展示的准备请求，请先从工作台提交一次。"),
    ).toBeInTheDocument();
  });
});

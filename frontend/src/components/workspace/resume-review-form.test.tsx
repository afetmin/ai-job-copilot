import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, scrollIntoViewMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  scrollIntoViewMock: vi.fn(),
}));

const { resolveResumeReviewAccessGateMock } = vi.hoisted(() => ({
  resolveResumeReviewAccessGateMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/lib/resume-review-access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/resume-review-access")>(
    "@/lib/resume-review-access",
  );

  return {
    ...actual,
    resolveResumeReviewAccessGate: resolveResumeReviewAccessGateMock,
  };
});

import {
  RESUME_REVIEW_SESSION_STORAGE_KEY,
  ResumeReviewForm,
} from "./resume-review-form";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function openStep(stepLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: stepLabel }));
}

function fillRequiredInputs() {
  fireEvent.change(screen.getByLabelText("简历内容"), {
    target: { value: "Built hiring workflows and interview tooling." },
  });

  openStep("02 岗位上下文");
  fireEvent.change(screen.getByLabelText("岗位描述"), {
    target: { value: "Backend role requires strong systems design." },
  });

  openStep("04 提交生成");
}

describe("ResumeReviewForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    scrollIntoViewMock.mockReset();
    resolveResumeReviewAccessGateMock.mockReset();
    resolveResumeReviewAccessGateMock.mockResolvedValue({
      remainingFreeAnalyses: 2,
      requiresUserModelConfig: false,
      hasLocalProviderSettings: false,
    });
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the first step by default and switches panels from the stepper", () => {
    render(<ResumeReviewForm />);

    expect(screen.getByRole("heading", { name: "简历材料" })).toBeInTheDocument();

    openStep("02 岗位上下文");

    expect(screen.getByRole("heading", { name: "岗位上下文" })).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it.each([
    [
      "简历内容",
      "Built hiring workflows and interview tooling.",
    ],
    [
      "岗位描述",
      "Backend role requires strong systems design.",
    ],
  ])("keeps submit preview-only when %s is the only completed main input", (providedLabel, providedValue) => {
    render(<ResumeReviewForm />);

    if (providedLabel === "岗位描述") {
      openStep("02 岗位上下文");
    }

    fireEvent.change(screen.getByLabelText(providedLabel), {
      target: { value: providedValue },
    });

    openStep("04 提交生成");

    expect(screen.getByRole("button", { name: "开始分析简历" })).toBeDisabled();
    expect(
      screen.getByText("当前只能预览提交流程。补齐简历和岗位材料后，分析按钮才会启用。"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables submit while the request is uploading", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<ResumeReviewForm />);

    fillRequiredInputs();

    const submitButton = screen.getByRole("button", { name: "开始分析简历" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());

    resolveFetch(
      jsonResponse({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        suggestionCount: 5,
        targetRole: "Backend Engineer",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          suggestion_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/results/req-test-123"));
  });

  it("shows a validation error when suggestionCount is invalid", async () => {
    render(<ResumeReviewForm />);

    fillRequiredInputs();
    openStep("03 调整参数");
    fireEvent.change(screen.getByLabelText("建议条数"), {
      target: { value: "0" },
    });

    openStep("04 提交生成");
    fireEvent.click(screen.getByRole("button", { name: "开始分析简历" }));

    expect(
      (await screen.findAllByText("建议条数必须是 1 到 20 之间的整数。")).length,
    ).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("normalizes a blank suggestionCount to the default before submitting", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        suggestionCount: 5,
        targetRole: "Backend Engineer",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          suggestion_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    render(<ResumeReviewForm />);

    fillRequiredInputs();
    openStep("03 调整参数");
    fireEvent.change(screen.getByLabelText("建议条数"), {
      target: { value: "" },
    });

    openStep("04 提交生成");
    fireEvent.click(screen.getByRole("button", { name: "开始分析简历" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    expect((requestBody as FormData).get("suggestionCount")).toBe("5");
  });

  it("rejects responses that do not include the full prepared payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
      }),
    );

    render(<ResumeReviewForm />);

    fillRequiredInputs();

    const submitButton = screen.getByRole("button", { name: "开始分析简历" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(RESUME_REVIEW_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("writes the success payload to sessionStorage and navigates to the result page", async () => {
    const createPayload = {
      requestId: "req-test-123",
      resumeDocumentId: "resume-doc-1",
      jobDescriptionDocumentId: "jd-doc-1",
      suggestionCount: 5,
      targetRole: "Backend Engineer",
      streamPayload: {
        resume_document_id: "resume-doc-1",
        job_description_document_id: "jd-doc-1",
        suggestion_count: 5,
        target_role: "Backend Engineer",
      },
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(createPayload));

    render(<ResumeReviewForm />);

    fillRequiredInputs();
    fireEvent.click(screen.getByRole("button", { name: "开始分析简历" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/results/req-test-123"));

    expect(
      JSON.parse(window.sessionStorage.getItem(RESUME_REVIEW_SESSION_STORAGE_KEY) ?? "null"),
    ).toEqual({
      ...createPayload,
      resumePreview: "Built hiring workflows and interview tooling.",
      jobDescriptionPreview: "Backend role requires strong systems design.",
    });
  });

  it("blocks submission when free quota is exhausted and no local provider settings exist", async () => {
    resolveResumeReviewAccessGateMock.mockResolvedValueOnce({
      remainingFreeAnalyses: 0,
      requiresUserModelConfig: true,
      hasLocalProviderSettings: false,
    });

    render(<ResumeReviewForm />);

    fillRequiredInputs();
    fireEvent.click(screen.getByRole("button", { name: "开始分析简历" }));

    expect(await screen.findByText("免费额度已用完，请先配置本地模型设置。")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

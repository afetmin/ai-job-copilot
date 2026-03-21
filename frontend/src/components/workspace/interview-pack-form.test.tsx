import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, scrollIntoViewMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  scrollIntoViewMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

import {
  INTERVIEW_PACK_SESSION_STORAGE_KEY,
  InterviewPackForm,
} from "./interview-pack-form";

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

describe("InterviewPackForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    scrollIntoViewMock.mockReset();
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
    render(<InterviewPackForm />);

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
    render(<InterviewPackForm />);

    if (providedLabel === "岗位描述") {
      openStep("02 岗位上下文");
    }

    fireEvent.change(screen.getByLabelText(providedLabel), {
      target: { value: providedValue },
    });

    openStep("04 提交生成");

    expect(screen.getByRole("button", { name: "生成面试包" })).toBeDisabled();
    expect(
      screen.getByText("当前只能预览提交流程。补齐简历和岗位材料后，生成按钮才会启用。"),
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

    render(<InterviewPackForm />);

    fillRequiredInputs();

    const submitButton = screen.getByRole("button", { name: "生成面试包" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());

    resolveFetch(
      jsonResponse({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        questionCount: 5,
        targetRole: "Backend Engineer",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          question_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/results/req-test-123"));
  });

  it("shows a validation error when questionCount is invalid", async () => {
    render(<InterviewPackForm />);

    fillRequiredInputs();
    openStep("03 调整参数");
    fireEvent.change(screen.getByLabelText("题目数量"), {
      target: { value: "0" },
    });

    openStep("04 提交生成");
    fireEvent.click(screen.getByRole("button", { name: "生成面试包" }));

    expect(
      (await screen.findAllByText("题目数量必须是 1 到 20 之间的整数。")).length,
    ).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("normalizes a blank questionCount to the default before submitting", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        questionCount: 5,
        targetRole: "Backend Engineer",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          question_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    render(<InterviewPackForm />);

    fillRequiredInputs();
    openStep("03 调整参数");
    fireEvent.change(screen.getByLabelText("题目数量"), {
      target: { value: "" },
    });

    openStep("04 提交生成");
    fireEvent.click(screen.getByRole("button", { name: "生成面试包" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    expect((requestBody as FormData).get("questionCount")).toBe("5");
  });

  it("rejects responses that do not include the full prepared payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
      }),
    );

    render(<InterviewPackForm />);

    fillRequiredInputs();

    const submitButton = screen.getByRole("button", { name: "生成面试包" });
    fireEvent.click(submitButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(INTERVIEW_PACK_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("writes the success payload to sessionStorage and navigates to the result page", async () => {
    const payload = {
      requestId: "req-test-123",
      resumeDocumentId: "resume-doc-1",
      jobDescriptionDocumentId: "jd-doc-1",
      questionCount: 5,
      targetRole: "Backend Engineer",
      streamPayload: {
        resume_document_id: "resume-doc-1",
        job_description_document_id: "jd-doc-1",
        question_count: 5,
        target_role: "Backend Engineer",
      },
    };

    fetchMock.mockResolvedValueOnce(jsonResponse(payload));

    render(<InterviewPackForm />);

    fillRequiredInputs();
    fireEvent.click(screen.getByRole("button", { name: "生成面试包" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/results/req-test-123"));

    expect(
      JSON.parse(window.sessionStorage.getItem(INTERVIEW_PACK_SESSION_STORAGE_KEY) ?? "null"),
    ).toEqual(payload);
  });
});

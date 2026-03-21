import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  deleteResumeReviewMock: vi.fn(),
  getProviderSettingsMock: vi.fn(),
  listResumeReviewsMock: vi.fn(),
  listMessagesForReviewMock: vi.fn(),
  saveProviderSettingsMock: vi.fn(),
  upsertChatMessageMock: vi.fn(),
  upsertResumeReviewMock: vi.fn(),
}));

vi.mock("@/lib/resume-review-db", () => ({
  deleteResumeReview: dbMocks.deleteResumeReviewMock,
  getProviderSettings: dbMocks.getProviderSettingsMock,
  listResumeReviews: dbMocks.listResumeReviewsMock,
  listMessagesForReview: dbMocks.listMessagesForReviewMock,
  saveProviderSettings: dbMocks.saveProviderSettingsMock,
  upsertChatMessage: dbMocks.upsertChatMessageMock,
  upsertResumeReview: dbMocks.upsertResumeReviewMock,
}));

import { ResultsWorkspace } from "./results-workspace";

function createSseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("ResultsWorkspace", () => {
  const fetchMock = vi.fn();
  const packRecord = {
    reviewId: "req-test-123",
    requestId: "req-test-123",
    resumeDocumentId: "resume-doc-1",
    jobDescriptionDocumentId: "jd-doc-1",
    suggestionCount: 5,
    targetRole: "Backend Engineer",
    resumePreview: "Built hiring workflows and interview tooling.",
    jobDescriptionPreview: "Backend role requires strong systems design.",
    analysisStatus: "pending" as const,
    createdAt: 10,
    updatedAt: 20,
    lastOpenedAt: 20,
  };
  const secondPackRecord = {
    reviewId: "pack-2",
    requestId: "req-test-456",
    resumeDocumentId: "resume-doc-2",
    jobDescriptionDocumentId: "jd-doc-2",
    suggestionCount: 7,
    targetRole: "AI Product Engineer",
    resumePreview: "Shipped retrieval pipelines and interview copilots.",
    jobDescriptionPreview: "Drive AI product implementation and experimentation.",
    analysisStatus: "completed" as const,
    createdAt: 30,
    updatedAt: 40,
    lastOpenedAt: 40,
  };

  beforeEach(() => {
    fetchMock.mockReset();
    dbMocks.deleteResumeReviewMock.mockReset();
    dbMocks.getProviderSettingsMock.mockReset();
    dbMocks.listResumeReviewsMock.mockReset();
    dbMocks.listMessagesForReviewMock.mockReset();
    dbMocks.saveProviderSettingsMock.mockReset();
    dbMocks.upsertChatMessageMock.mockReset();
    dbMocks.upsertResumeReviewMock.mockReset();

    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      "workspace:resume-review:prepared-request",
      JSON.stringify({
        requestId: "req-test-123",
        resumeDocumentId: "resume-doc-1",
        jobDescriptionDocumentId: "jd-doc-1",
        suggestionCount: 5,
        targetRole: "Backend Engineer",
        resumePreview: "Built hiring workflows and interview tooling.",
        jobDescriptionPreview: "Backend role requires strong systems design.",
        streamPayload: {
          resume_document_id: "resume-doc-1",
          job_description_document_id: "jd-doc-1",
          suggestion_count: 5,
          target_role: "Backend Engineer",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
    dbMocks.deleteResumeReviewMock.mockResolvedValue(undefined);
    dbMocks.getProviderSettingsMock.mockResolvedValue(null);
    dbMocks.listResumeReviewsMock.mockResolvedValue([packRecord]);
    dbMocks.listMessagesForReviewMock.mockResolvedValue([]);
    dbMocks.upsertResumeReviewMock.mockImplementation(async (input: unknown) => ({
      ...packRecord,
      ...(input as object),
    }));
    dbMocks.upsertChatMessageMock.mockImplementation(async (input: unknown) => ({
      citations: [],
      createdAt: 10,
      updatedAt: 10,
      ...(input as object),
    }));
    fetchMock.mockResolvedValueOnce(
      createSseResponse(
        [
          'event: start\ndata: {"review_id":"req-test-123","request_id":"req-test-123"}',
          'event: metadata\ndata: {"metadata":{"suggestion_count":5,"resume_chunk_count":2,"job_description_chunk_count":1,"focus_points":["系统设计","项目复盘"]}}',
          'event: citation\ndata: {"citation":{"citation_id":"resume:0","source_type":"resume","title":"resume.pdf","excerpt":"Built retrieval pipelines.","score":0.91}}',
          'event: delta\ndata: {"delta":"# 初始分析\\n\\n## 主要问题诊断\\n\\n- 简历与 JD 基本匹配，但结果表达还可以更具体"}',
          'event: done\ndata: {"review_id":"req-test-123"}',
          "",
        ].join("\n\n"),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("imports the prepared request and renders the compact chat layout", async () => {
    render(<ResultsWorkspace requestId="req-test-123" />);

    await waitFor(() =>
      expect(dbMocks.upsertResumeReviewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewId: "req-test-123",
          resumePreview: "Built hiring workflows and interview tooling.",
          jobDescriptionPreview: "Backend role requires strong systems design.",
        }),
      ),
    );

    expect(await screen.findAllByText("Backend Engineer")).not.toHaveLength(0);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/resume-reviews/chat",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );

    expect((await screen.findAllByText("对话列表")).length).toBeGreaterThan(0);
    expect(screen.queryByText("已保存档案")).not.toBeInTheDocument();
    expect(screen.queryByText("当前跳转载荷")).not.toBeInTheDocument();
    expect(screen.getByText("消息数")).toBeInTheDocument();
    expect(screen.getByText("引用数")).toBeInTheDocument();
    expect(screen.getByText("输入修改追问")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /发送/i })).toBeDisabled();
    expect(await screen.findByRole("heading", { name: "初始分析" })).toBeInTheDocument();
    expect(screen.getByText("引用依据 (1)")).toBeInTheDocument();
    expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    expect(screen.getByText("Built retrieval pipelines.")).toBeInTheDocument();
  });

  it("opens model settings in a dialog instead of rendering them inline", async () => {
    dbMocks.listMessagesForReviewMock.mockResolvedValue([
      {
        messageId: "initial_analysis:req-test-123",
        reviewId: "req-test-123",
        role: "assistant",
        kind: "initial_analysis",
        content: "Saved initial_analysis content",
        status: "done",
        citations: [],
        createdAt: 10,
        updatedAt: 10,
      },
    ]);

    render(<ResultsWorkspace requestId="req-test-123" />);

    expect(screen.queryByRole("heading", { name: "本机 BYOK" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "模型配置" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "本机模型设置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "本机 BYOK" })).toBeInTheDocument();
  });

  it("renders the full message stream in one dialog and switches by pack", async () => {
    dbMocks.listResumeReviewsMock.mockResolvedValue([packRecord, secondPackRecord]);
    dbMocks.listMessagesForReviewMock.mockImplementation(async (reviewId: string) => {
      if (reviewId === "req-test-123") {
        return [
          {
            messageId: "initial_analysis:req-test-123",
            reviewId: "req-test-123",
            role: "assistant",
            kind: "initial_analysis",
            content: "第一条初始信息",
            status: "done",
            citations: [],
            createdAt: 10,
            updatedAt: 10,
          },
          {
            messageId: "follow-up:req-test-123:1",
            reviewId: "req-test-123",
            role: "user",
            kind: "follow_up",
            content: "第二条追问",
            status: "done",
            citations: [],
            createdAt: 11,
            updatedAt: 11,
          },
        ];
      }

      return [
        {
          messageId: "initial_analysis:pack-2",
          reviewId: "pack-2",
          role: "assistant",
          kind: "initial_analysis",
          content: "第二个对话的初始信息",
          status: "done",
          citations: [],
          createdAt: 12,
          updatedAt: 12,
        },
      ];
    });

    render(<ResultsWorkspace requestId="req-test-123" />);

    expect(await screen.findByText("第一条初始信息")).toBeInTheDocument();
    expect(screen.getByText("第二条追问")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /ai product engineer/i }));

    expect(await screen.findByText("第二个对话的初始信息")).toBeInTheDocument();
  });

  it("does not initial_analysis a newly selected pack before that pack's messages finish hydrating", async () => {
    const secondPackMessages = deferred<
      Array<{
        messageId: string;
        reviewId: string;
        role: "assistant";
        kind: "initial_analysis";
        content: string;
        status: "done";
        citations: [];
        createdAt: number;
        updatedAt: number;
      }>
    >();

    dbMocks.listResumeReviewsMock.mockResolvedValue([packRecord, secondPackRecord]);
    dbMocks.listMessagesForReviewMock.mockImplementation((reviewId: string) => {
      if (reviewId === "req-test-123") {
        return Promise.resolve([
          {
            messageId: "initial_analysis:req-test-123",
            reviewId: "req-test-123",
            role: "assistant",
            kind: "initial_analysis",
            content: "当前对话的初始信息",
            status: "done",
            citations: [],
            createdAt: 10,
            updatedAt: 10,
          },
        ]);
      }

      return secondPackMessages.promise;
    });
    fetchMock.mockReset();

    render(<ResultsWorkspace requestId="req-test-123" />);

    expect(await screen.findByText("当前对话的初始信息")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /ai product engineer/i }));

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });

    secondPackMessages.resolve([
      {
        messageId: "initial_analysis:pack-2",
        reviewId: "pack-2",
        role: "assistant",
        kind: "initial_analysis",
        content: "第二个对话加载完成",
        status: "done",
        citations: [],
        createdAt: 12,
        updatedAt: 12,
      },
    ]);

    expect(await screen.findByText("第二个对话加载完成")).toBeInTheDocument();
  });
});

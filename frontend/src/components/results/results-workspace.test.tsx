import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  deleteChatMessageMock: vi.fn(),
  deleteResumeReviewMock: vi.fn(),
  getProviderSettingsMock: vi.fn(),
  listResumeReviewsMock: vi.fn(),
  listMessagesForReviewMock: vi.fn(),
  saveProviderSettingsMock: vi.fn(),
  upsertChatMessageMock: vi.fn(),
  upsertResumeReviewMock: vi.fn(),
}));

vi.mock("@/lib/resume-review-db", () => ({
  deleteChatMessage: dbMocks.deleteChatMessageMock,
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

function createControlledSseResponse() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    },
  });
  const encoder = new TextEncoder();

  return {
    response: new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
      },
    }),
    push(chunk: string) {
      controller?.enqueue(encoder.encode(chunk));
    },
    close() {
      controller?.close();
    },
  };
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
    dbMocks.deleteChatMessageMock.mockReset();
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
    dbMocks.deleteChatMessageMock.mockResolvedValue(undefined);
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
          'event: citation\ndata: {"citation":{"citation_id":"resume:0","source_type":"resume","title":"resume.pdf","excerpt":"Built retrieval pipelines.","relevance_level":"high","score":0.18}}',
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

    expect(screen.getByText("简历分析工作台")).toBeInTheDocument();
    expect((await screen.findAllByText("对话列表")).length).toBeGreaterThan(0);
    expect(screen.queryByText("已保存档案")).not.toBeInTheDocument();
    expect(screen.queryByText("当前跳转载荷")).not.toBeInTheDocument();
    expect(screen.getByText("消息数")).toBeInTheDocument();
    expect(screen.getByText("引用数")).toBeInTheDocument();
    expect(screen.getByText("输入修改追问")).toBeInTheDocument();
    expect(screen.getByText("对话列表").closest("section")?.className).toContain(
      "overflow-hidden",
    );
    expect(screen.getByText("对话列表").closest("section")?.className).toContain("flex");
    expect(screen.getByLabelText("对话列表滚动区域").className).toContain("overflow-y-auto");
    expect(screen.getByLabelText("对话列表滚动区域").className).toContain("paper-scrollbar");
    expect(screen.getByText("对话列表").closest("aside")?.className).toContain(
      "xl:h-[calc(100dvh-9.1rem)]",
    );
    expect(screen.getByLabelText("分析消息流").className).toContain("paper-scrollbar");
    expect(screen.getByLabelText("分析消息流").className).toContain("overflow-y-auto");
    expect(screen.getByRole("button", { name: /发送/i })).toBeDisabled();
    expect(await screen.findByRole("heading", { name: "初始分析" })).toBeInTheDocument();
    expect(screen.getByText("引用依据 (1)")).toBeInTheDocument();
    expect(screen.getByLabelText("简历 引用：resume.pdf")).toBeInTheDocument();
    expect(screen.getByText("悬停查看详情")).toBeInTheDocument();
  });

  it("reveals citations only after the assistant message is done streaming", async () => {
    const controlledStream = createControlledSseResponse();

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(controlledStream.response);

    render(<ResultsWorkspace requestId="req-test-123" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/resume-reviews/chat",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );

    controlledStream.push(
      'event: start\ndata: {"review_id":"req-test-123","request_id":"req-test-123"}\n\n'
        + 'event: metadata\ndata: {"metadata":{"suggestion_count":5,"resume_chunk_count":2,"job_description_chunk_count":1,"focus_points":["系统设计","项目复盘"]}}\n\n'
        + 'event: citation\ndata: {"citation":{"citation_id":"resume:0","source_type":"resume","title":"resume.pdf","excerpt":"Built retrieval pipelines.","relevance_level":"high","score":0.18}}\n\n'
        + 'event: delta\ndata: {"delta":"# 初始分析\\n\\n流式回答中"}\n\n',
    );

    expect(await screen.findByRole("heading", { name: "初始分析" })).toBeInTheDocument();
    expect(screen.queryByText("引用依据 (1)")).not.toBeInTheDocument();
    expect(screen.queryByText("resume.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Built retrieval pipelines.")).not.toBeInTheDocument();

    controlledStream.push('event: done\ndata: {"review_id":"req-test-123"}\n\n');
    controlledStream.close();

    await waitFor(() => {
      expect(screen.getByText("引用依据 (1)")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("简历 引用：resume.pdf")).toBeInTheDocument();
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

  it("does not leak an in-flight stream into a newly selected pack", async () => {
    const controlledStream = createControlledSseResponse();

    dbMocks.listResumeReviewsMock.mockResolvedValue([packRecord, secondPackRecord]);
    dbMocks.listMessagesForReviewMock.mockImplementation(async (reviewId: string) => {
      if (reviewId === "pack-2") {
        return [
          {
            messageId: "initial_analysis:pack-2",
            reviewId: "pack-2",
            role: "assistant",
            kind: "initial_analysis",
            content: "第二个对话保持原样",
            status: "done",
            citations: [],
            createdAt: 12,
            updatedAt: 12,
          },
        ];
      }

      return [];
    });
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(controlledStream.response);

    render(<ResultsWorkspace requestId="req-test-123" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/resume-reviews/chat",
        expect.objectContaining({ method: "POST" }),
      ),
    );

    fireEvent.click(await screen.findByRole("button", { name: /ai product engineer/i }));

    expect(await screen.findByText("第二个对话保持原样")).toBeInTheDocument();

    controlledStream.push(
      'event: delta\ndata: {"delta":"旧对话不应该串到新对话"}\n\n'
        + 'event: done\ndata: {"review_id":"req-test-123"}\n\n',
    );
    controlledStream.close();

    await waitFor(() => {
      expect(screen.queryByText("旧对话不应该串到新对话")).not.toBeInTheDocument();
    });
  });

  it("retries interrupted initial analysis without persisting the synthetic prompt as a user message", async () => {
    const messagesByReviewId: Record<string, Array<Record<string, unknown>>> = {
      "req-test-123": [],
      "pack-2": [
        {
          messageId: "initial_analysis:pack-2",
          reviewId: "pack-2",
          role: "assistant",
          kind: "initial_analysis",
          content: "第二个对话保持可读",
          status: "done",
          citations: [],
          createdAt: 12,
          updatedAt: 12,
        },
      ],
    };

    dbMocks.listResumeReviewsMock.mockResolvedValue([packRecord, secondPackRecord]);
    dbMocks.listMessagesForReviewMock.mockImplementation(async (reviewId: string) => {
      return [...(messagesByReviewId[reviewId] ?? [])];
    });
    dbMocks.upsertChatMessageMock.mockImplementation(async (input: Record<string, unknown>) => {
      const record = {
        citations: [],
        createdAt: 10,
        updatedAt: 10,
        ...input,
      };
      const reviewId = record.reviewId as string;
      const nextMessages = [...(messagesByReviewId[reviewId] ?? [])];
      const targetIndex = nextMessages.findIndex(
        (message) => message.messageId === record.messageId,
      );
      if (targetIndex === -1) {
        nextMessages.push(record);
      } else {
        nextMessages[targetIndex] = record;
      }
      messagesByReviewId[reviewId] = nextMessages;
      return record;
    });
    dbMocks.deleteChatMessageMock.mockImplementation(async (messageId: string) => {
      messagesByReviewId["req-test-123"] = (messagesByReviewId["req-test-123"] ?? []).filter(
        (message) => message.messageId !== messageId,
      );
    });

    fetchMock.mockReset();
    const retriedInitialStream = createControlledSseResponse();
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    fetchMock.mockResolvedValueOnce(retriedInitialStream.response);
    render(<ResultsWorkspace requestId="req-test-123" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /ai product engineer/i }));
    expect(await screen.findByText("第二个对话保持可读")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /backend engineer/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("正在基于简历与 JD 生成分析...")).toBeInTheDocument();
    expect(
      screen.queryByText("请先给我这份简历针对目标岗位的整体分析和修改建议。"),
    ).not.toBeInTheDocument();
    expect(dbMocks.deleteChatMessageMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      retriedInitialStream.close();
    });
  });

  it("marks an interrupted follow-up as error instead of leaving it streaming forever", async () => {
    const messagesByReviewId: Record<string, Array<Record<string, unknown>>> = {
      "req-test-123": [
        {
          messageId: "initial_analysis:req-test-123",
          reviewId: "req-test-123",
          role: "assistant",
          kind: "initial_analysis",
          content: "初始分析已完成",
          status: "done",
          citations: [],
          createdAt: 10,
          updatedAt: 10,
        },
      ],
      "pack-2": [
        {
          messageId: "initial_analysis:pack-2",
          reviewId: "pack-2",
          role: "assistant",
          kind: "initial_analysis",
          content: "第二个对话保持原样",
          status: "done",
          citations: [],
          createdAt: 12,
          updatedAt: 12,
        },
      ],
    };

    dbMocks.listResumeReviewsMock.mockResolvedValue([packRecord, secondPackRecord]);
    dbMocks.listMessagesForReviewMock.mockImplementation(async (reviewId: string) => {
      return [...(messagesByReviewId[reviewId] ?? [])];
    });
    dbMocks.upsertChatMessageMock.mockImplementation(async (input: Record<string, unknown>) => {
      const record = {
        citations: [],
        createdAt: 10,
        updatedAt: 10,
        ...input,
      };
      const reviewId = record.reviewId as string;
      const nextMessages = [...(messagesByReviewId[reviewId] ?? [])];
      const targetIndex = nextMessages.findIndex(
        (message) => message.messageId === record.messageId,
      );
      if (targetIndex === -1) {
        nextMessages.push(record);
      } else {
        nextMessages[targetIndex] = record;
      }
      messagesByReviewId[reviewId] = nextMessages;
      return record;
    });

    fetchMock.mockReset();
    fetchMock.mockImplementationOnce((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    render(<ResultsWorkspace requestId="req-test-123" />);

    expect(await screen.findByText("初始分析已完成")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("输入修改追问"), {
      target: { value: "还有什么信息吗" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /ai product engineer/i }));
    expect(await screen.findByText("第二个对话保持原样")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /backend engineer/i }));

    expect(await screen.findByText("本次追问已中断，请重新发送。")).toBeInTheDocument();
    expect(screen.getByText("还有什么信息吗")).toBeInTheDocument();
    expect(screen.queryByText("正在基于简历与 JD 生成分析...")).not.toBeInTheDocument();
  });

  it("recovers the composer after a transport-level stream failure", async () => {
    render(<ResultsWorkspace requestId="req-test-123" />);

    expect(await screen.findByRole("heading", { name: "初始分析" })).toBeInTheDocument();

    const sendButton = screen.getByRole("button", { name: "发送" });
    fireEvent.change(screen.getByLabelText("输入修改追问"), {
      target: { value: "请重点改写项目经历。" },
    });

    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
        },
      }),
    );

    fireEvent.click(sendButton);

    await waitFor(() =>
      expect(screen.getAllByText("追问发送失败，请稍后重试。").length).toBeGreaterThan(0),
    );

    fireEvent.change(screen.getByLabelText("输入修改追问"), {
      target: { value: "请再给我一个改写版本。" },
    });

    expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();
  });
});

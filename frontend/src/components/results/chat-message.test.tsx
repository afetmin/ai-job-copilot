import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessageRecord } from "@/lib/resume-review-db";

import { ChatMessage } from "./chat-message";

const assistantMessage: ChatMessageRecord = {
  messageId: "assistant:1",
  reviewId: "review-1",
  role: "assistant",
  kind: "initial_analysis",
  content: "已完成回答",
  status: "done",
  citations: [
    {
      id: "resume:1",
      sourceType: "resume",
      title: "resume.pdf",
      snippet: "Built retrieval pipelines and led platform migration.",
      relevanceLevel: "high",
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};

describe("ChatMessage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the citation popover open briefly after leaving the trigger", () => {
    vi.useFakeTimers();

    render(<ChatMessage message={assistantMessage} />);

    const trigger = screen.getByRole("button", { name: "简历 引用：resume.pdf" });

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip").className).toContain("paper-scrollbar-compact");
    expect(screen.getByText("高相关")).toBeInTheDocument();
    expect(screen.getByText("Built retrieval pipelines and led platform migration.")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByRole("tooltip"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("uses fixed labels for follow-up turns and replies", () => {
    const userFollowUp: ChatMessageRecord = {
      ...assistantMessage,
      messageId: "user:follow-up",
      role: "user",
      kind: "follow_up",
      content: "请继续优化项目经历。",
      citations: [],
    };

    const assistantReply: ChatMessageRecord = {
      ...assistantMessage,
      messageId: "assistant:follow-up",
      role: "assistant",
      kind: "follow_up",
      content: "这里是针对追问的回复。",
      citations: [],
    };

    const { rerender } = render(<ChatMessage message={userFollowUp} />);
    expect(screen.getByText("追问")).toBeInTheDocument();

    rerender(<ChatMessage message={assistantReply} />);
    expect(screen.getByText("回复")).toBeInTheDocument();
  });

  it("keeps long content constrained inside the message card", () => {
    render(
      <ChatMessage
        message={{
          ...assistantMessage,
          content:
            "精通React/Vue主流框架，熟悉微前端架构、组件化开发、Figma/Axure、ECharts/AntV数据可视化。",
        }}
      />,
    );

    expect(
      screen.getByText(/精通React\/Vue主流框架/).closest("article")?.className,
    ).toContain("min-w-0");
    expect(
      screen.getByText(/精通React\/Vue主流框架/).closest("article")?.className,
    ).toContain("overflow-hidden");
  });
});

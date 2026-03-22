import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

import { EntryGate } from "./entry-gate";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("EntryGate", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the minimal project explanation and password form", () => {
    render(<EntryGate />);

    expect(screen.getByRole("heading", { name: "开始简历诊断" })).toBeInTheDocument();
    expect(
      screen.getByText("输入访问密码后进入工作台：上传简历与 JD，自动生成匹配度诊断、风险提示和可执行改写建议。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("访问密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入分析工作台" })).toBeInTheDocument();
  });

  it("submits the password and routes to workspace on success", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    render(<EntryGate />);

    fireEvent.change(screen.getByLabelText("访问密码"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "进入分析工作台" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/workspace"));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows an error message when login fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 500));

    render(<EntryGate />);

    fireEvent.change(screen.getByLabelText("访问密码"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "进入分析工作台" }));

    expect(await screen.findByText("登录失败，请检查访问权限后重试。")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

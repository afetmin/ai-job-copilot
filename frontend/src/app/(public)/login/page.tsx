"use client";

import { type FormEvent, useState, useTransition } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Radar, ScanSearch, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const capabilities = [
    {
      title: "候选人输入",
      description: "把简历文本、PDF 材料和项目履历收敛成同一份候选人上下文。",
      Icon: ScanSearch,
    },
    {
      title: "岗位对齐",
      description: "把岗位描述、职责要求和关注维度并列纳入同一次生成请求。",
      Icon: Radar,
    },
    {
      title: "优化档案",
      description: "把诊断结论、来源锚点和后续追问串成可追溯的结果档案。",
      Icon: Sparkles,
    },
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setErrorMessage("进入工作台失败，请稍后重试。");
        return;
      }

      router.push("/workspace");
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.32fr)_400px]">
          <section className="relative overflow-hidden border-2 border-foreground bg-[rgba(251,247,242,0.96)] p-6 shadow-[6px_6px_0_#161616] sm:p-8 lg:p-10">
            <div className="absolute left-6 top-6 h-10 w-24 border-2 border-foreground bg-[rgba(255,210,31,0.16)]" />
            <div className="absolute right-8 top-10 h-12 w-20 border-2 border-foreground bg-[rgba(97,184,255,0.18)]" />

            <div className="relative space-y-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] shadow-[4px_4px_0_#161616]">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                  受保护入口
                </span>
                <span className="inline-flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] shadow-[4px_4px_0_#161616]">
                  <LockKeyhole className="h-3.5 w-3.5" strokeWidth={1.5} />
                  优化控制台
                </span>
              </div>

              <div className="max-w-3xl space-y-5">
                <p className="font-mono text-[0.76rem] uppercase tracking-[0.1em] text-muted-foreground">
                  编辑式工作流外壳
                </p>
                <h1 className="font-mono text-[clamp(3rem,8vw,5.8rem)] font-normal uppercase leading-[0.94] tracking-[0.09em]">
                  AI 求职助手
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  这是进入内部求职分析系统的门禁入口。下一步会进入分步工作台，完成候选人材料整理、岗位对齐与简历优化分析。
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {capabilities.map(({ title, description, Icon }) => (
                  <article
                    key={title}
                    className="border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_#161616]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center border-2 border-foreground bg-[rgba(255,210,31,0.24)]">
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <p className="font-mono text-sm uppercase tracking-[0.08em]">{title}</p>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.75fr)]">
                <div className="border-2 border-foreground bg-[rgba(255,255,255,0.55)] p-5 shadow-[4px_4px_0_#161616]">
                  <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    <span>系统框架</span>
                    <span>就绪</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-foreground">
                    入口页只负责建立上下文，不负责身份管理。当前继续调用现有登录 API，输入任意内容即可进入保护路由，便于验证工作台和结果页的端到端视觉改造。
                  </p>
                </div>

                <div className="border-2 border-foreground bg-[rgba(251,247,242,0.9)] p-5 shadow-[4px_4px_0_#161616]">
                  <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-muted-foreground">
                    后续流程
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-foreground">
                    <li className="border-2 border-foreground bg-card px-3 py-2 shadow-[3px_3px_0_#161616]">
                      01 / 上传或粘贴简历材料
                    </li>
                    <li className="border-2 border-foreground bg-card px-3 py-2 shadow-[3px_3px_0_#161616]">
                      02 / 输入岗位描述与目标角色
                    </li>
                    <li className="border-2 border-foreground bg-card px-3 py-2 shadow-[3px_3px_0_#161616]">
                      03 / 生成并进入结果页
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <aside className="relative overflow-hidden border-2 border-foreground bg-[rgba(251,247,242,0.96)] p-6 shadow-[6px_6px_0_#161616] sm:p-7">
            <div className="absolute right-5 top-5 h-12 w-20 border-2 border-foreground bg-[rgba(255,111,116,0.16)]" />

            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 border-2 border-foreground bg-[rgba(255,210,31,0.22)] px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] shadow-[4px_4px_0_#161616]">
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                  访问门禁
                </span>
                <LockKeyhole className="h-5 w-5" strokeWidth={1.5} />
              </div>

              <div className="space-y-3">
                <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-muted-foreground">
                  进入工作台
                </p>
                <h2 className="font-mono text-[1.9rem] font-normal uppercase leading-[0.98] tracking-[0.09em]">
                  进入工作台
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  当前阶段不限制账号体系，保留这个入口是为了维持保护路由与后续工作流的一致性。
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    访问密码
                  </Label>
                  <Input
                    id="password"
                    placeholder="当前任意输入都可进入"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>

                {errorMessage ? (
                  <p className="border-2 border-foreground bg-[rgba(255,111,116,0.14)] px-3 py-2 text-sm leading-6 text-foreground shadow-[4px_4px_0_#161616]">
                    {errorMessage}
                  </p>
                ) : (
                  <p className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] px-3 py-2 text-sm leading-6 text-muted-foreground shadow-[4px_4px_0_#161616]">
                    保留现有后端行为，仅重构进入体验。提交后会跳转到 `/workspace`。
                  </p>
                )}

                <Button className="w-full" disabled={isPending} size="lg" type="submit">
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{isPending ? "正在进入..." : "进入工作台"}</span>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                </Button>
              </form>

              <div className="space-y-4">
                <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                    路由
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    `/login` -&gt; `/workspace` -&gt; `/results/[requestId]`
                  </p>
                </div>
                <div className="border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_#161616]">
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                    当前契约
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    登录 API、cookie 逻辑和后续提交链路保持不变。
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

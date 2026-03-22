"use client";

import { type FormEvent, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EntryGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

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
        setErrorMessage("登录失败，请检查访问权限后重试。");
        return;
      }

      router.push("/workspace");
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen px-4 py-3 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[720px] items-center justify-center">
        <section className="w-full border-2 border-foreground bg-[rgba(251,247,242,0.97)] p-6 shadow-[6px_6px_0_#161616] sm:p-8">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="font-mono text-[0.74rem] uppercase tracking-[0.08em] text-muted-foreground">
                AI 求职分析平台
              </p>
              <h1 className="font-mono text-[clamp(2.5rem,7vw,4.4rem)] font-normal uppercase leading-[0.94] tracking-[0.06em]">
                开始简历诊断
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                输入访问密码后进入工作台：上传简历与 JD，自动生成匹配度诊断、风险提示和可执行改写建议。
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">访问密码</Label>
                <Input
                  id="password"
                  placeholder="输入任意密码进入工作台"
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
                  登录后可直接创建分析任务，沉淀简历问题清单，并持续追问优化方案。
                </p>
              )}

              <Button className="w-full" disabled={isPending} size="lg" type="submit">
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{isPending ? "正在验证..." : "进入分析工作台"}</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

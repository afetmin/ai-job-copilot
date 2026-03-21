import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AppShellProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function AppShell({
  eyebrow = "内部分析系统",
  title,
  subtitle,
  children,
  aside,
  className,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen", className)}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="paper-panel overflow-hidden p-5 sm:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="meta-chip">AI 求职助手</span>
                <span className="meta-chip">{eyebrow}</span>
              </div>

              <div className="space-y-3">
                <p className="mono-kicker text-muted-foreground">编辑式工作流外壳</p>
                <h1 className="ink-title text-[clamp(2.2rem,6vw,4.8rem)] leading-[1.02] text-foreground">
                  {title}
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="meta-chip">可追踪请求上下文</span>
                <span className="meta-chip">表单优先工作流</span>
                <span className="meta-chip">面试包暂存区</span>
              </div>
            </div>

            <div className="panel-dark p-5">
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.08em] text-white/72">
                <span>控制台</span>
                <span>实时视图</span>
              </div>
              <Separator className="my-4 bg-white/20" />
              <div className="space-y-4 text-sm leading-6 text-white/82">
                <div>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/58">
                    任务
                  </p>
                  <p className="mt-2">
                    收集结构化候选人上下文，与目标岗位对齐，再把请求送入面试生成链路。
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/58">
                    边界
                  </p>
                  <p className="mt-2">
                    前端继续兼容现有 API 契约，同时把交互模型收束成更明确的内部分析系统。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className={cn("mt-8 grid gap-6", aside ? "xl:grid-cols-[minmax(0,1.35fr)_320px]" : undefined)}>
          <section className="space-y-6">{children}</section>
          {aside ? <aside className="space-y-6">{aside}</aside> : null}
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground/80 px-1 pt-4">
          <p className="font-mono text-[0.74rem] uppercase tracking-[0.06em] text-muted-foreground">
            AI 求职助手 / 内部产品外壳 / 2026
          </p>
          <p className="font-mono text-[0.74rem] uppercase tracking-[0.06em] text-muted-foreground">
            以装裱式界面构建，而不是通用后台
          </p>
        </footer>
      </main>
    </div>
  );
}

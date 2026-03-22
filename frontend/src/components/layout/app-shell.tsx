import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
};

export function AppShell({
  title,
  subtitle,
  children,
  aside,
  headerActions,
  className,
}: AppShellProps) {
  return (
    <div className={cn("min-h-screen", className)}>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <header className="paper-panel overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2.5">
              <h1 className="ink-title text-[clamp(1.9rem,5vw,3.9rem)] leading-[1.01] text-foreground">
                {title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {subtitle}
              </p>
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-start lg:justify-end">{headerActions}</div>
            ) : null}
          </div>
        </header>

        <div
          className={cn(
            "mt-5 grid gap-4",
            aside ? "xl:grid-cols-[minmax(0,1.35fr)_320px]" : undefined,
          )}
        >
          <section className="space-y-4">{children}</section>
          {aside ? <aside className="space-y-4">{aside}</aside> : null}
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-foreground/80 px-1 pt-3">
          <p className="font-mono text-[0.74rem] uppercase tracking-[0.06em] text-muted-foreground">
            AI 求职助手 / 简历与 JD 对齐分析平台 / 2026
          </p>
          <p className="font-mono text-[0.74rem] uppercase tracking-[0.06em] text-muted-foreground">
            让经历对准岗位，让改写有据可依
          </p>
        </footer>
      </main>
    </div>
  );
}

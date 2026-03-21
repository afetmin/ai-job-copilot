import { ArrowUpRight, BookOpenText, ListChecks, Quote, ScrollText, Sparkles } from "lucide-react";
import Link from "next/link";

import { RequestBootstrap } from "@/components/results/request-bootstrap";
import { cn } from "@/lib/utils";

const returnLinkShellClassName =
  "group relative inline-flex w-full align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const returnLinkBackdropClassName =
  "pointer-events-none absolute inset-0 rounded-[2px] bg-[#161616] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-active:opacity-100";

const returnLinkBodyClassName =
  "relative z-10 inline-flex h-12 w-full items-center justify-between whitespace-nowrap rounded-[2px] border-2 px-6 py-2 font-mono text-[0.95rem] uppercase tracking-[0.08em] transition-[transform,background-color,border-color,color] duration-200 ease-out group-hover:-translate-x-[2px] group-hover:-translate-y-[2px] group-active:-translate-x-px group-active:-translate-y-px border-white/10 bg-white/5 text-white hover:border-white/10 hover:bg-white/10 hover:text-white";

type ResultsPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { requestId } = await params;
  const summaryItems = [
    { label: "请求 ID", value: requestId },
    { label: "视图", value: "面试包档案" },
    { label: "引导状态", value: "基于会话的上下文" },
    { label: "模式", value: "来源感知审阅" },
  ];

  return (
    <main className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden border-2 border-foreground bg-[rgba(251,247,242,0.96)] p-6 shadow-[6px_6px_0_#161616] sm:p-8">
          <div className="absolute left-6 top-6 h-10 w-24 border-2 border-foreground bg-[rgba(255,210,31,0.16)]" />
          <div className="absolute right-8 top-8 h-12 w-20 border-2 border-foreground bg-[rgba(97,184,255,0.18)]" />

          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] shadow-[4px_4px_0_#161616]">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                受保护结果页
              </span>
              <span className="inline-flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] shadow-[4px_4px_0_#161616]">
                <ListChecks className="h-3.5 w-3.5" strokeWidth={1.5} />
                档案控制台
              </span>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_320px]">
              <div className="space-y-5">
                <p className="font-mono text-[0.76rem] uppercase tracking-[0.1em] text-muted-foreground">
                  面试包档案
                </p>
                <h1 className="font-mono text-[clamp(2.6rem,7vw,5.2rem)] font-normal uppercase leading-[0.96] tracking-[0.09em]">
                  面试包档案
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  结果页被重构成一份分析档案，而不是单纯的占位页。这里会承接题目流、来源锚点、请求元信息以及后续追问区。
                </p>
              </div>

              <div className="border-2 border-foreground bg-[rgba(22,22,22,0.96)] p-5 text-[#f7f2ea] shadow-[5px_5px_0_#161616]">
                <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.08em] text-white/70">
                  <span>请求控制台</span>
                  <span>实时视图</span>
                </div>
                <div className="mt-4 border-2 border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/56">
                    请求 ID
                  </p>
                  <p className="mt-2 break-all text-sm leading-6 text-white/88">{requestId}</p>
                </div>
                <Link
                  href="/workspace"
                  className={cn(returnLinkShellClassName, "mt-4")}
                >
                  <span aria-hidden="true" className={returnLinkBackdropClassName} />
                  <span className={returnLinkBodyClassName}>
                    <span>返回工作台</span>
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="border-2 border-foreground bg-card px-4 py-4 shadow-[4px_4px_0_#161616]"
                >
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 break-all text-sm leading-6">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            <article className="border-2 border-foreground bg-card p-6 shadow-[5px_5px_0_#161616] sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-foreground bg-[rgba(255,210,31,0.18)]">
                  <ListChecks className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-muted-foreground">
                    题目流
                  </p>
                  <h2 className="mt-2 font-mono text-[1.6rem] font-normal uppercase leading-[0.98] tracking-[0.08em]">
                    题面面板
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  {
                    title: "题目流待填充",
                    detail: `请求 ${requestId} 已进入结果档案页，后续题目块会沿着这个请求逐步展开。`,
                  },
                  {
                    title: "回答锚点已预留",
                    detail: "参考回答、关键点和追问策略将附着在每一题下方，而不是分散在独立页面。",
                  },
                  {
                    title: "引用框架已预留",
                    detail: "来源文档和检索切片会以来源注记的形式挂在右侧档案区，并与题目块建立回链。",
                  },
                ].map((item, index) => (
                  <div key={item.title} className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] p-5 shadow-[4px_4px_0_#161616]">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center justify-center border-2 border-foreground bg-[rgba(255,210,31,0.2)] px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em]">
                        {`0${index + 1}`}
                      </span>
                      <p className="font-mono text-base uppercase tracking-[0.08em]">{item.title}</p>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="border-2 border-foreground bg-card p-6 shadow-[5px_5px_0_#161616] sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-foreground bg-[rgba(97,184,255,0.18)]">
                  <ScrollText className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-muted-foreground">
                    题目地图
                  </p>
                  <h2 className="mt-2 font-mono text-[1.6rem] font-normal uppercase leading-[0.98] tracking-[0.08em]">
                    提示拓扑
                  </h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] p-5 shadow-[4px_4px_0_#161616]">
                  <div className="flex items-center gap-3">
                    <BookOpenText className="h-5 w-5" strokeWidth={1.5} />
                    <p className="font-mono text-sm uppercase tracking-[0.08em]">来源感知题目</p>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    每道题最终会绑定来源、难度标签、推荐追问和回答关键点。
                  </p>
                </div>
                <div className="border-2 border-foreground bg-[rgba(255,255,255,0.5)] p-5 shadow-[4px_4px_0_#161616]">
                  <div className="flex items-center gap-3">
                    <Quote className="h-5 w-5" strokeWidth={1.5} />
                    <p className="font-mono text-sm uppercase tracking-[0.08em]">追问预留区</p>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    追问区将直接挂在结果档案页底部，不再跳出到独立会话视图。
                  </p>
                </div>
              </div>
            </article>

            <article className="border-2 border-foreground bg-[rgba(22,22,22,0.96)] p-6 text-[#f7f2ea] shadow-[5px_5px_0_#161616] sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center border-2 border-white/10 bg-white/5">
                  <Quote className="h-5 w-5 text-[#ffd21f]" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-white/62">
                    追问区域
                  </p>
                  <h2 className="mt-2 font-mono text-[1.6rem] font-normal uppercase leading-[0.98] tracking-[0.08em]">
                    为追问细化预留
                  </h2>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/78">
                当前版本先建立版式和信息层级。等流式生成和追问链路接入后，这里会承接针对具体题目的追加问题、回答补写和引用回链。
              </p>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {["引用回链", "追问输入", "回答补全"].map((item) => (
                  <div key={item} className="border border-white/12 bg-white/5 px-4 py-4 shadow-[3px_3px_0_#000]">
                    <p className="font-mono text-[0.74rem] uppercase tracking-[0.08em] text-white/56">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="space-y-6">
            <div className="border-2 border-foreground bg-[rgba(22,22,22,0.96)] p-5 text-[#f7f2ea] shadow-[5px_5px_0_#161616]">
              <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-white/62">
                请求控制台
              </p>
              <div className="mt-4 space-y-3">
                <div className="border-2 border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/54">
                    请求 ID
                  </p>
                  <p className="mt-2 break-all text-sm leading-6 text-white/86">{requestId}</p>
                </div>
                <div className="border-2 border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80">
                  右侧档案区保留请求引导信息和来源锚点，方便后续把引用片段接进来。
                </div>
              </div>
              <Link
                href="/workspace"
                className={cn(returnLinkShellClassName, "mt-4")}
              >
                <span aria-hidden="true" className={returnLinkBackdropClassName} />
                <span className={returnLinkBodyClassName}>
                  <span>返回工作台</span>
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </Link>
            </div>

            <div className="border-2 border-foreground bg-card p-5 shadow-[5px_5px_0_#161616]">
              <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-muted-foreground">
                来源档案
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                右侧档案区继续承接 sessionStorage 的准备请求，维持结果页与工作台之间的短链路。
              </p>
              <div className="mt-5">
                <RequestBootstrap requestId={requestId} />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

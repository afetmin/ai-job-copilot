import { AlertTriangle, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type GenerationStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "ready_to_generate"
  | "failed";

type StatusMeta = {
  label: string;
  description: string;
  nextStep: string;
  Icon: LucideIcon;
};

const STATUS_META: Record<GenerationStatus, StatusMeta> = {
  idle: {
    label: "等待输入",
    description: "先在左侧补全简历和岗位材料。",
    nextStep: "材料齐备后在右侧执行提交。",
    Icon: Sparkles,
  },
  validating: {
    label: "校验输入",
    description: "正在检查简历、岗位描述和建议条数。",
    nextStep: "校验通过后会开始发送创建请求。",
    Icon: LoaderCircle,
  },
  uploading: {
    label: "上传中",
    description: "简历和岗位描述正在发送到后端。",
    nextStep: "请求完成后会跳转到结果页。",
    Icon: LoaderCircle,
  },
  ready_to_generate: {
    label: "准备跳转",
    description: "创建请求已返回，准备进入简历优化结果页。",
    nextStep: "稍后会自动打开结果页面。",
    Icon: CheckCircle2,
  },
  failed: {
    label: "提交失败",
    description: "请检查表单内容后重试。",
    nextStep: "修正输入后再次提交。",
    Icon: AlertTriangle,
  },
};

type GenerationStatusCardProps = {
  status: GenerationStatus;
  message?: string | null;
};

export function GenerationStatusCard({ status, message }: GenerationStatusCardProps) {
  const meta = STATUS_META[status];
  const displayMessage = status === "failed" && message ? message : meta.description;

  return (
    <div className="rounded-[2px] border-2 border-foreground bg-foreground p-4 text-background shadow-[12px_12px_0_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex items-center justify-between gap-4 border-b border-white/14 pb-4">
        <div>
          <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-white/60">
            生成状态
          </p>
          <h3 className="mt-2 font-mono text-[1rem] font-normal uppercase tracking-[0.08em] text-white/92">
            执行中控
          </h3>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[2px] border-2 border-background bg-accent text-accent-foreground">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </div>

      <div className="mt-4 rounded-[2px] border border-white/14 bg-white/6 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] border-2 border-white/18 bg-white/8 text-[#fbf7f2]">
            <meta.Icon className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/56">
              当前阶段
            </p>
            <p className="mt-2 text-base text-white/92">{meta.label}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {[
          { label: "说明", value: displayMessage },
          { label: "下一步", value: meta.nextStep },
          {
            label: "链路",
            value: "工作台只发一次创建请求，成功后写入 sessionStorage 并跳转到结果页。",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[2px] border border-white/14 bg-white/6 px-4 py-3">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/54">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/86">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

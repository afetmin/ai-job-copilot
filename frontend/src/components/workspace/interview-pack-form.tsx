"use client";

import { Fragment, type FormEvent, type ReactNode, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCheck,
  FileStack,
  ListTodo,
  NotebookTabs,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { type GenerationStatus } from "./generation-status-card";

export const INTERVIEW_PACK_SESSION_STORAGE_KEY =
  "workspace:interview-pack:prepared-request";

const DEFAULT_QUESTION_COUNT = 5;
const RESUME_REQUIRED_MESSAGE = "请填写简历内容或上传简历文件（PDF/TXT）。";
const JOB_DESCRIPTION_REQUIRED_MESSAGE = "请填写岗位描述或上传岗位描述文件（PDF/TXT）。";
const QUESTION_COUNT_REQUIRED_MESSAGE = "题目数量必须是 1 到 20 之间的整数。";
const GENERIC_SUBMISSION_ERROR_MESSAGE = "提交失败，请稍后重试。";

type StepId = "01" | "02" | "03" | "04";

type FormErrors = {
  resume?: string;
  jobDescription?: string;
  questionCount?: string;
  form?: string;
};

type InterviewPackCreateResponse = {
  requestId: string;
  resumeDocumentId: string;
  jobDescriptionDocumentId: string;
  questionCount: number;
  targetRole: string | null;
  streamPayload: {
    resume_document_id: string;
    job_description_document_id: string;
    question_count: number;
    target_role: string | null;
  };
};

type PreparedInterviewPackResponse = InterviewPackCreateResponse;

type StepSectionProps = {
  activeStep: StepId;
  step: StepId;
  title: string;
  description: string;
  label: string;
  children: ReactNode;
};

type StepTone = "ready" | "pending" | "active";

type ProcessStep = {
  step: StepId;
  title: string;
  shortTitle: string;
  stateLabel: string;
  tone: StepTone;
};

function WorkspaceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[2px] border-2 border-foreground/85 bg-card p-5 shadow-[10px_10px_0_rgba(0,0,0,0.08)] sm:p-6">
      {children}
    </div>
  );
}

function getStringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFileField(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function parseQuestionCount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return DEFAULT_QUESTION_COUNT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return null;
  }

  return parsed;
}

function hasDocumentInput(text: string, file: File | null): boolean {
  return text.trim().length > 0 || (file !== null && file.size > 0);
}

function buildValidationErrors(formData: FormData): FormErrors {
  const resumeText = getStringField(formData, "resumeText");
  const resumeFile = getFileField(formData, "resumeFile");
  const jobDescriptionText = getStringField(formData, "jobDescriptionText");
  const jobDescriptionFile = getFileField(formData, "jobDescriptionFile");
  const questionCount = parseQuestionCount(formData.get("questionCount"));

  const nextErrors: FormErrors = {};
  if (!hasDocumentInput(resumeText, resumeFile)) {
    nextErrors.resume = RESUME_REQUIRED_MESSAGE;
  }
  if (!hasDocumentInput(jobDescriptionText, jobDescriptionFile)) {
    nextErrors.jobDescription = JOB_DESCRIPTION_REQUIRED_MESSAGE;
  }
  if (questionCount === null) {
    nextErrors.questionCount = QUESTION_COUNT_REQUIRED_MESSAGE;
  }

  return nextErrors;
}

function isPreparedInterviewPackResponse(
  value: unknown,
): value is PreparedInterviewPackResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const streamPayload = payload.streamPayload;

  if (
    typeof payload.requestId !== "string" ||
    payload.requestId.trim() === "" ||
    typeof payload.resumeDocumentId !== "string" ||
    payload.resumeDocumentId.trim() === "" ||
    typeof payload.jobDescriptionDocumentId !== "string" ||
    payload.jobDescriptionDocumentId.trim() === "" ||
    typeof payload.questionCount !== "number" ||
    !Number.isInteger(payload.questionCount) ||
    payload.questionCount < 1 ||
    payload.questionCount > 20 ||
    !(typeof payload.targetRole === "string" || payload.targetRole === null)
  ) {
    return false;
  }

  if (typeof streamPayload !== "object" || streamPayload === null) {
    return false;
  }

  const stream = streamPayload as Record<string, unknown>;
  return (
    typeof stream.resume_document_id === "string" &&
    stream.resume_document_id.trim() !== "" &&
    typeof stream.job_description_document_id === "string" &&
    stream.job_description_document_id.trim() !== "" &&
    typeof stream.question_count === "number" &&
    Number.isInteger(stream.question_count) &&
    stream.question_count >= 1 &&
    stream.question_count <= 20 &&
    (typeof stream.target_role === "string" || stream.target_role === null)
  );
}

function getStepIcon(step: StepId) {
  if (step === "01") {
    return FileStack;
  }
  if (step === "02") {
    return BriefcaseBusiness;
  }
  if (step === "03") {
    return SlidersHorizontal;
  }
  return CheckCheck;
}

function StatusPill({ label, tone }: { label: string; tone: StepTone }) {
  const toneClassName =
    tone === "ready"
      ? "border-emerald-700/45 bg-emerald-100 text-emerald-900"
      : tone === "active"
        ? "border-sky-700/45 bg-sky-100 text-sky-950"
        : "border-foreground/25 bg-background text-muted-foreground";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-[2px] border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.08em] ${toneClassName}`}
    >
      {label}
    </span>
  );
}

function StepSection({
  activeStep,
  step,
  title,
  description,
  label,
  children,
}: StepSectionProps) {
  return (
    <section
      className={activeStep === step ? "block" : "hidden"}
      data-step-panel={step}
      id={`step-panel-${step}`}
    >
      <WorkspaceFrame>
        <div className="flex flex-col gap-4 border-b-2 border-foreground/10 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] border-2 border-foreground bg-accent font-mono text-[0.82rem] uppercase tracking-[0.08em] text-accent-foreground">
              {step}
            </div>
            <div className="min-w-0">
              <h2
                className="font-mono text-[1.25rem] font-normal uppercase tracking-[0.08em] text-foreground"
                id={`step-panel-heading-${step}`}
              >
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-[2px] border-2 border-foreground/80 bg-secondary px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-foreground">
            {label}
          </span>
        </div>
        <div className="mt-5">{children}</div>
      </WorkspaceFrame>
    </section>
  );
}

function StepConnector({ tone }: { tone: StepTone }) {
  return (
    <div
      aria-hidden="true"
      className={`h-[2px] w-8 shrink-0 sm:w-12 ${
        tone === "ready" ? "bg-emerald-500/80" : "bg-foreground/18"
      }`}
    />
  );
}

function ProcessStepBlock({
  step,
  title,
  shortTitle,
  stateLabel,
  tone,
  isActive,
  onSelect,
}: ProcessStep & { isActive: boolean; onSelect: (step: StepId) => void }) {
  const Icon = getStepIcon(step);

  const className = isActive
    ? tone === "ready"
      ? "border-emerald-700 bg-emerald-100 text-emerald-950 shadow-[8px_8px_0_rgba(22,101,52,0.18)]"
      : "border-sky-700 bg-sky-100 text-sky-950 shadow-[8px_8px_0_rgba(3,105,161,0.18)]"
    : tone === "ready"
      ? "border-emerald-700/65 bg-emerald-50 text-emerald-950 shadow-[6px_6px_0_rgba(22,101,52,0.12)]"
      : "border-foreground/75 bg-background text-foreground shadow-[6px_6px_0_rgba(0,0,0,0.05)]";

  return (
    <button
      aria-label={`${step} ${title}`}
      aria-pressed={isActive}
      className={`flex h-[92px] w-[92px] shrink-0 flex-col items-start justify-between rounded-[2px] border-2 px-3 py-3 text-left transition-all ${className}`}
      onClick={() => onSelect(step)}
      type="button"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="font-mono text-[0.72rem] uppercase tracking-[0.08em]">{step}</span>
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      </div>
      <div className="w-full">
        <p className="font-mono text-[0.78rem] uppercase tracking-[0.08em]">{shortTitle}</p>
        <p className="mt-1 text-[0.68rem] leading-4 opacity-80">{stateLabel}</p>
      </div>
    </button>
  );
}

function NarrativePanel({
  statusLabel,
  statusTone,
  statusTitle,
  statusDescription,
  actionTitle,
  actionBody,
  nextTitle,
  nextBody,
  footer,
}: {
  statusLabel: string;
  statusTone: StepTone;
  statusTitle: string;
  statusDescription: string;
  actionTitle: string;
  actionBody: string[];
  nextTitle: string;
  nextBody: string[];
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-[2px] border-2 border-foreground bg-foreground p-5 text-background shadow-[12px_12px_0_rgba(0,0,0,0.18)]">
      <div className="space-y-5">
        <div className="border-b border-white/14 pb-5">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/58">
            当前状态
          </p>
          <h3 className="mt-2 font-mono text-[1.05rem] uppercase tracking-[0.08em] text-white/92">
            {statusTitle}
          </h3>
          <div className="mt-3">
            <StatusPill label={statusLabel} tone={statusTone} />
          </div>
          <p className="mt-4 text-sm leading-6 text-white/78">{statusDescription}</p>
        </div>

        <div className="border-b border-white/14 pb-5">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/58">
            这一步做什么
          </p>
          <h3 className="mt-2 font-mono text-[1.05rem] uppercase tracking-[0.08em] text-white/92">
            {actionTitle}
          </h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            {actionBody.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-white/58">
            下一步
          </p>
          <h3 className="mt-2 font-mono text-[1.05rem] uppercase tracking-[0.08em] text-white/92">
            {nextTitle}
          </h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            {nextBody.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>

        {footer ? <div className="border-t border-white/14 pt-5">{footer}</div> : null}
      </div>
    </div>
  );
}

function readSubmitState(status: GenerationStatus, isFormReady: boolean): {
  label: string;
  tone: StepTone;
  description: string;
} {
  if (status === "uploading" || status === "validating") {
    return {
      label: "处理中",
      tone: "active",
      description: "请求正在校验并发送到创建接口。",
    };
  }

  if (status === "ready_to_generate") {
    return {
      label: "已提交",
      tone: "ready",
      description: "请求已经创建，页面即将跳转到结果档案。",
    };
  }

  if (status === "failed") {
    return {
      label: "需修正",
      tone: "pending",
      description: "先修正缺失内容或错误参数，再重新提交。",
    };
  }

  if (isFormReady) {
    return {
      label: "可执行",
      tone: "ready",
      description: "主输入已补齐，可以进入提交步骤。",
    };
  }

  return {
    label: "预览中",
    tone: "pending",
    description: "当前只开放提交流程预览。补齐简历和岗位材料后，生成按钮才会启用。",
  };
}

function readParameterState(errors: FormErrors, targetRoleValue: string): {
  label: string;
  tone: StepTone;
  description: string;
} {
  if (errors.questionCount) {
    return {
      label: "需修正",
      tone: "pending",
      description: "题目数量需要修正后才能继续提交。",
    };
  }

  if (targetRoleValue.trim()) {
    return {
      label: "已配置",
      tone: "ready",
      description: `目标岗位已设为 ${targetRoleValue.trim()}，题目数量保持可调。`,
    };
  }

  return {
    label: "默认配置",
    tone: "ready",
    description: "题目数量默认 5 题，目标岗位可选填。",
  };
}

function getFirstInvalidStep(errors: FormErrors): StepId | null {
  if (errors.resume) {
    return "01";
  }
  if (errors.jobDescription) {
    return "02";
  }
  if (errors.questionCount) {
    return "03";
  }
  if (errors.form) {
    return "04";
  }
  return null;
}

export function InterviewPackForm() {
  const router = useRouter();
  const panelTopRef = useRef<HTMLDivElement | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>("01");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [errors, setErrors] = useState<FormErrors>({});
  const [resumeTextValue, setResumeTextValue] = useState("");
  const [jobDescriptionTextValue, setJobDescriptionTextValue] = useState("");
  const [targetRoleValue, setTargetRoleValue] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [jobDescriptionFileName, setJobDescriptionFileName] = useState<string | null>(null);

  const isUploading = status === "uploading";
  const hasResumePreview = resumeTextValue.trim().length > 0 || resumeFileName !== null;
  const hasJobDescriptionPreview =
    jobDescriptionTextValue.trim().length > 0 || jobDescriptionFileName !== null;
  const isFormReady = hasResumePreview && hasJobDescriptionPreview;
  const submitState = readSubmitState(status, isFormReady);
  const parameterState = readParameterState(errors, targetRoleValue);
  const processSteps: ProcessStep[] = [
    {
      step: "01",
      title: "简历材料",
      shortTitle: "简历",
      stateLabel: hasResumePreview ? "已就绪" : "待补充",
      tone: hasResumePreview ? "ready" : activeStep === "01" ? "active" : "pending",
    },
    {
      step: "02",
      title: "岗位上下文",
      shortTitle: "岗位",
      stateLabel: hasJobDescriptionPreview ? "已就绪" : "待补充",
      tone: hasJobDescriptionPreview ? "ready" : activeStep === "02" ? "active" : "pending",
    },
    {
      step: "03",
      title: "调整参数",
      shortTitle: "参数",
      stateLabel: parameterState.label,
      tone: parameterState.tone,
    },
    {
      step: "04",
      title: "提交生成",
      shortTitle: "提交",
      stateLabel: submitState.label,
      tone: submitState.tone,
    },
  ];

  function scrollToPanel() {
    panelTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSelectStep(step: StepId) {
    setActiveStep(step);
    scrollToPanel();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUploading || !isFormReady) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const nextErrors = buildValidationErrors(formData);

    setStatus("validating");
    setErrors({});
    setActiveStep("04");

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidStep = getFirstInvalidStep(nextErrors);
      setErrors(nextErrors);
      setStatus("failed");
      if (firstInvalidStep) {
        setActiveStep(firstInvalidStep);
      }
      scrollToPanel();
      return;
    }

    const normalizedQuestionCount = parseQuestionCount(formData.get("questionCount"));
    if (normalizedQuestionCount !== null) {
      formData.set("questionCount", String(normalizedQuestionCount));
    }

    const requestPromise = fetch("/api/interview-packs/create", {
      method: "POST",
      body: formData,
    });

    setStatus("uploading");

    let response: Response;
    try {
      response = await requestPromise;
    } catch {
      setErrors({ form: GENERIC_SUBMISSION_ERROR_MESSAGE });
      setStatus("failed");
      setActiveStep("04");
      scrollToPanel();
      return;
    }

    if (!response.ok) {
      setErrors({ form: GENERIC_SUBMISSION_ERROR_MESSAGE });
      setStatus("failed");
      setActiveStep("04");
      scrollToPanel();
      return;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      setErrors({ form: GENERIC_SUBMISSION_ERROR_MESSAGE });
      setStatus("failed");
      setActiveStep("04");
      scrollToPanel();
      return;
    }

    if (!isPreparedInterviewPackResponse(payload)) {
      setErrors({ form: GENERIC_SUBMISSION_ERROR_MESSAGE });
      setStatus("failed");
      setActiveStep("04");
      scrollToPanel();
      return;
    }

    window.sessionStorage.setItem(
      INTERVIEW_PACK_SESSION_STORAGE_KEY,
      JSON.stringify(payload),
    );
    setStatus("ready_to_generate");
    router.push(`/results/${payload.requestId}`);
  }

  function handleReset() {
    setErrors({});
    setStatus("idle");
    setActiveStep("01");
    setResumeTextValue("");
    setJobDescriptionTextValue("");
    setTargetRoleValue("");
    setResumeFileName(null);
    setJobDescriptionFileName(null);
  }

  return (
    <AppShell
      eyebrow="受保护工作台"
      title="面试包工作台"
      subtitle="收集候选人材料、对齐岗位上下文、配置生成参数，并保持整条请求链路可追踪。"
    >
      <div className="space-y-5">
        <div className="sticky top-3 z-30">
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <div className="min-w-max rounded-[2px] border-2 border-foreground/85 bg-card/95 p-3 shadow-[10px_10px_0_rgba(0,0,0,0.08)] backdrop-blur">
              <div className="flex items-center gap-3">
                {processSteps.map((item, index) => (
                  <Fragment key={item.step}>
                    <ProcessStepBlock
                      {...item}
                      isActive={activeStep === item.step}
                      onSelect={handleSelectStep}
                    />
                    {index < processSteps.length - 1 ? <StepConnector tone={item.tone} /> : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        <form noValidate className="space-y-5" onReset={handleReset} onSubmit={handleSubmit}>
          <div className="scroll-mt-32" ref={panelTopRef}>
            <StepSection
              activeStep={activeStep}
              description="把候选人的经历、项目亮点或简历 PDF 放进来。这里专门承接候选人上下文，不混入岗位信息。"
              label="候选人输入"
              step="01"
              title="简历材料"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
                <div className="rounded-[2px] border-2 border-foreground/80 bg-background p-5 shadow-[10px_10px_0_rgba(0,0,0,0.06)]">
                  <div className="space-y-5">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="resumeText">简历内容</Label>
                          <Textarea
                            id="resumeText"
                            name="resumeText"
                            placeholder="在这里粘贴结构化简历、项目亮点或候选人材料。"
                            value={resumeTextValue}
                            onChange={(event) => setResumeTextValue(event.target.value)}
                          />
                          <p className="text-sm leading-6 text-muted-foreground">
                            优先粘贴结构化文本，方便后续检索、排查和生成。
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="resumeFile">简历文件（PDF/TXT）</Label>
                          <Input
                            accept=".pdf,.txt,application/pdf,text/plain"
                            id="resumeFile"
                            name="resumeFile"
                            onChange={(event) =>
                              setResumeFileName(event.target.files?.[0]?.name ?? null)
                            }
                            type="file"
                          />
                          <p className="text-sm leading-6 text-muted-foreground">
                            需要保留原始文档时，再补充 PDF 或 TXT。
                          </p>
                        </div>
                        <div className="rounded-[2px] border-2 border-foreground/80 bg-background px-4 py-4 shadow-[6px_6px_0_rgba(0,0,0,0.05)]">
                          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                            当前摘要
                          </p>
                          <div className="mt-3 space-y-3 text-sm leading-6 text-foreground">
                            <p>{resumeTextValue.trim() ? "已填写简历文本" : "未填写简历文本"}</p>
                            <p>{resumeFileName ? `已选择 ${resumeFileName}` : "未上传简历文件"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {errors.resume ? (
                      <p className="text-sm font-medium leading-6 text-destructive">{errors.resume}</p>
                    ) : null}
                  </div>
                </div>

                <NarrativePanel
                  actionBody={[
                    "这里承接简历、项目亮点、经历摘要，不要混入 JD 约束。",
                    "如果你已经有结构化简历文本，优先贴文本，PDF 作为原始附件补充。",
                  ]}
                  actionTitle="沉淀候选人上下文"
                  nextBody={["切到第 02 步，把职责、要求、评估维度写在一起，形成完整对照面。"]}
                  nextTitle="进入岗位上下文"
                  statusDescription={
                    hasResumePreview
                      ? "这一侧已经具备候选人输入，可以继续切到岗位上下文。"
                      : "至少填写简历文本或补充一份 PDF，流程导航会变成绿色。"
                  }
                  statusLabel={hasResumePreview ? "已就绪" : "待补充"}
                  statusTitle={hasResumePreview ? "简历材料已就绪" : "等待补齐简历材料"}
                  statusTone={hasResumePreview ? "ready" : "pending"}
                />
              </div>
            </StepSection>

            <StepSection
              activeStep={activeStep}
              description="把岗位职责、要求和评估维度收敛到同一处，避免和候选人材料混写。"
              label="岗位输入"
              step="02"
              title="岗位上下文"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
                <div className="rounded-[2px] border-2 border-foreground/80 bg-background p-5 shadow-[10px_10px_0_rgba(0,0,0,0.06)]">
                  <div className="space-y-5">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="jobDescriptionText">岗位描述</Label>
                          <Textarea
                            id="jobDescriptionText"
                            name="jobDescriptionText"
                            placeholder="在这里粘贴目标岗位说明、职责要求和评估维度。"
                            value={jobDescriptionTextValue}
                            onChange={(event) => setJobDescriptionTextValue(event.target.value)}
                          />
                          <p className="text-sm leading-6 text-muted-foreground">
                            这里适合粘贴 JD 正文、面试侧重点和团队预期。
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="jobDescriptionFile">岗位描述文件（PDF/TXT）</Label>
                          <Input
                            accept=".pdf,.txt,application/pdf,text/plain"
                            id="jobDescriptionFile"
                            name="jobDescriptionFile"
                            onChange={(event) =>
                              setJobDescriptionFileName(event.target.files?.[0]?.name ?? null)
                            }
                            type="file"
                          />
                          <p className="text-sm leading-6 text-muted-foreground">
                            有完整岗位文档时，再补充 PDF 或 TXT。
                          </p>
                        </div>
                        <div className="rounded-[2px] border-2 border-foreground/80 bg-background px-4 py-4 shadow-[6px_6px_0_rgba(0,0,0,0.05)]">
                          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
                            当前摘要
                          </p>
                          <div className="mt-3 space-y-3 text-sm leading-6 text-foreground">
                            <p>
                              {jobDescriptionTextValue.trim() ? "已填写岗位文本" : "未填写岗位文本"}
                            </p>
                            <p>
                              {jobDescriptionFileName
                                ? `已选择 ${jobDescriptionFileName}`
                                : "未上传岗位文件"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {errors.jobDescription ? (
                      <p className="text-sm font-medium leading-6 text-destructive">
                        {errors.jobDescription}
                      </p>
                    ) : null}
                  </div>
                </div>

                <NarrativePanel
                  actionBody={[
                    "把职责、硬性要求、面试侧重点和评估维度放在同一处，避免信息分散。",
                    "这一步越完整，后续面试包越接近真实场景。",
                  ]}
                  actionTitle="收敛岗位要求"
                  nextBody={["切到第 03 步，确认目标岗位和题目数量，准备进入提交阶段。"]}
                  nextTitle="进入参数设置"
                  statusDescription={
                    hasJobDescriptionPreview
                      ? "岗位侧输入已经就绪，可以进入参数和提交步骤。"
                      : "至少填写岗位文本或补充 PDF，这一步完成后提交流程才会解锁。"
                  }
                  statusLabel={hasJobDescriptionPreview ? "已就绪" : "待补充"}
                  statusTitle={hasJobDescriptionPreview ? "岗位上下文已就绪" : "等待补齐岗位信息"}
                  statusTone={hasJobDescriptionPreview ? "ready" : "pending"}
                />
              </div>
            </StepSection>

            <StepSection
              activeStep={activeStep}
              description="题目数量和目标岗位集中在这里配置，前两步的输入不需要重复确认。"
              label="生成参数"
              step="03"
              title="调整参数"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
                <div className="rounded-[2px] border-2 border-foreground/80 bg-background p-5 shadow-[10px_10px_0_rgba(0,0,0,0.06)]">
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="targetRole">目标岗位</Label>
                        <Input
                          autoComplete="off"
                          id="targetRole"
                          name="targetRole"
                          onChange={(event) => setTargetRoleValue(event.target.value)}
                          placeholder="后端工程师"
                          value={targetRoleValue}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="questionCount">题目数量</Label>
                        <Input
                          defaultValue={DEFAULT_QUESTION_COUNT}
                          id="questionCount"
                          max={20}
                          min={1}
                          name="questionCount"
                          type="number"
                        />
                      </div>
                    </div>

                    {errors.questionCount ? (
                      <p className="text-sm font-medium leading-6 text-destructive">
                        {errors.questionCount}
                      </p>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          icon: NotebookTabs,
                          title: "目标岗位",
                          value: "可选填，用来让结果更接近真实面试语境。",
                        },
                        {
                          icon: ListTodo,
                          title: "题目数量",
                          value: "默认 5 题，可在 1 到 20 之间调整。",
                        },
                      ].map(({ icon: Icon, title, value }) => (
                        <div
                          key={title}
                          className="rounded-[2px] border-2 border-foreground/80 bg-secondary px-4 py-4 shadow-[6px_6px_0_rgba(0,0,0,0.05)]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[2px] border-2 border-foreground bg-background">
                              <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                            </div>
                            <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-foreground">
                              {title}
                            </p>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <NarrativePanel
                  actionBody={[
                    "参数只影响生成方式，不再重复要求你确认前两步材料。",
                    "目标岗位适合在你想让题目贴近真实语境时填写；否则保持为空即可。",
                  ]}
                  actionTitle="收紧生成口径"
                  nextBody={["第 04 步会读取当前表单并直接发起创建请求，成功后跳转到结果档案页。"]}
                  nextTitle="进入提交生成"
                  statusDescription={parameterState.description}
                  statusLabel={parameterState.label}
                  statusTitle={parameterState.label}
                  statusTone={parameterState.tone}
                />
              </div>
            </StepSection>

            <StepSection
              activeStep={activeStep}
              description="这里不再展示所有输入，只负责解释提交行为、显示当前状态，并在条件满足后执行生成。"
              label="提交与状态"
              step="04"
              title="提交生成"
            >
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_360px]">
                <div className="rounded-[2px] border-2 border-foreground/80 bg-background p-5 shadow-[10px_10px_0_rgba(0,0,0,0.06)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[2px] border-2 border-foreground bg-accent text-accent-foreground">
                        <Send className="h-4 w-4" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-mono text-[0.76rem] uppercase tracking-[0.08em] text-muted-foreground">
                          04 / 提交任务
                        </p>
                        <h2 className="mt-2 font-mono text-[1.3rem] font-normal uppercase tracking-[0.08em] text-foreground">
                          提交任务
                        </h2>
                      </div>
                    </div>
                    <StatusPill label={submitState.label} tone={submitState.tone} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {isFormReady
                      ? "主输入已补齐。这里会直接提交当前表单，并保持原有的创建、存储和跳转逻辑。"
                      : "当前只能预览提交流程。补齐简历和岗位材料后，生成按钮才会启用。"}
                  </p>

                  <div className="mt-5 grid gap-3">
                    {[
                      {
                        title: "01 / 简历材料",
                        status: hasResumePreview ? "已就绪" : "待补充",
                        summary: hasResumePreview
                          ? resumeFileName
                            ? `已填写简历内容，并附带 ${resumeFileName}。`
                            : "已填写简历内容，可直接用于生成。"
                          : "还没有简历文本或 PDF，先补齐候选人材料。",
                      },
                      {
                        title: "02 / 岗位上下文",
                        status: hasJobDescriptionPreview ? "已就绪" : "待补充",
                        summary: hasJobDescriptionPreview
                          ? jobDescriptionFileName
                            ? `岗位信息已补齐，并附带 ${jobDescriptionFileName}。`
                            : "岗位文本已补齐，可以用于约束生成语境。"
                          : "还没有岗位文本或 PDF，这一步完成后提交流程才会解锁。",
                      },
                      {
                        title: "03 / 生成参数",
                        status: parameterState.label,
                        summary: errors.questionCount
                          ? errors.questionCount
                          : targetRoleValue.trim()
                            ? `目标岗位为 ${targetRoleValue.trim()}，题目数量沿用当前输入。`
                            : `当前使用默认参数，题目数量默认为 ${DEFAULT_QUESTION_COUNT}。`,
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-[2px] border border-foreground/15 bg-secondary px-4 py-3 text-sm leading-6 text-muted-foreground"
                      >
                        <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-2 text-foreground">{item.status}</p>
                        <p className="mt-1">{item.summary}</p>
                      </div>
                    ))}
                  </div>

                  {errors.form ? (
                    <p className="mt-4 text-sm font-medium leading-6 text-destructive">{errors.form}</p>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button disabled={!isFormReady || isUploading} size="lg" type="submit">
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>{isUploading ? "上传中..." : "生成面试包"}</span>
                        <Send className="h-4 w-4" strokeWidth={1.5} />
                      </span>
                    </Button>
                    <Button disabled={isUploading} size="lg" type="reset" variant="secondary">
                      清空表单
                    </Button>
                  </div>
                </div>

                <NarrativePanel
                  actionBody={[
                    "当前页会把已有表单数据提交到创建接口，成功后把响应写入 `sessionStorage`。",
                    "随后页面会跳转到结果档案页，继续读取准备好的请求数据。",
                  ]}
                  actionTitle="解释提交流程"
                  nextBody={[
                    isFormReady
                      ? "确认无误后直接触发生成，请求成功后会进入结果页。"
                      : "先回到前两步补齐主输入，再回来执行生成。",
                  ]}
                  nextTitle={isFormReady ? "直接生成" : "返回补齐输入"}
                  statusDescription={submitState.description}
                  statusLabel={submitState.label}
                  statusTitle={submitState.label}
                  statusTone={submitState.tone}
                />
              </div>
            </StepSection>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

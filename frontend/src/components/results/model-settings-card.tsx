"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  ModelProtocol,
  ProviderSettingsInput,
  ProviderSettingsRecord,
} from "@/lib/resume-review-db";

type ModelSettingsCardProps = {
  settings: ProviderSettingsRecord | null;
  onSave: (settings: ProviderSettingsInput) => Promise<void> | void;
};

const MODEL_PROTOCOL_OPTIONS: Array<{ label: string; value: ModelProtocol }> = [
  { label: "OpenAI 兼容", value: "openai_compatible" },
  { label: "Anthropic 兼容", value: "anthropic_compatible" },
];

const BASE_URL_PLACEHOLDERS: Record<ModelProtocol, string> = {
  openai_compatible: "https://api.openai.com/v1",
  anthropic_compatible: "https://api.anthropic.com",
};

export function ModelSettingsCard({ settings, onSave }: ModelSettingsCardProps) {
  const [protocol, setProtocol] = useState<ModelProtocol>("openai_compatible");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProtocol(settings?.protocol ?? "openai_compatible");
    setApiKey(settings?.apiKey ?? "");
    setModel(settings?.model ?? "");
    setBaseUrl(settings?.baseUrl ?? "");
  }, [settings]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ protocol, apiKey, model, baseUrl });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <section className="border-2 border-foreground bg-card p-5 shadow-[5px_5px_0_#161616]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.08em] text-muted-foreground">
            模型设置
          </p>
        </div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
          {saved ? "已保存" : settings ? "已加载" : "可选配置"}
        </p>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="protocol">协议类型</Label>
          <Select
            id="protocol"
            onValueChange={(nextValue) => setProtocol(nextValue as ModelProtocol)}
            options={MODEL_PROTOCOL_OPTIONS}
            value={protocol}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">模型名称</Label>
          <Input
            id="model"
            onChange={(event) => setModel(event.target.value)}
            placeholder="如：gpt-4.1-mini / claude-sonnet-4-5"
            value={model}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiKey">API 密钥</Label>
          <Input
            id="apiKey"
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="输入模型服务密钥"
            value={apiKey}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseUrl">服务地址</Label>
          <Input
            id="baseUrl"
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={BASE_URL_PLACEHOLDERS[protocol]}
            value={baseUrl}
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          免费初始化次数用完后，会优先使用当前标签页会话中的模型配置；关闭标签页后自动清除。
        </p>
        <Button size="sm" type="submit">
          保存设置
        </Button>
      </form>
    </section>
  );
}

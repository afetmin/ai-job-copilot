"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderSettingsInput, ProviderSettingsRecord } from "@/lib/resume-review-db";

type ModelSettingsCardProps = {
  settings: ProviderSettingsRecord | null;
  onSave: (settings: ProviderSettingsInput) => Promise<void> | void;
};

export function ModelSettingsCard({ settings, onSave }: ModelSettingsCardProps) {
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProvider(settings?.provider ?? "");
    setApiKey(settings?.apiKey ?? "");
    setModel(settings?.model ?? "");
    setBaseUrl(settings?.baseUrl ?? "");
  }, [settings]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ provider, apiKey, model, baseUrl });
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
          <h2 className="mt-2 font-mono text-[1.1rem] uppercase tracking-[0.08em]">
            本机 BYOK
          </h2>
        </div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
          {saved ? "Saved" : settings ? "Loaded" : "Optional"}
        </p>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Input
            id="provider"
            onChange={(event) => setProvider(event.target.value)}
            placeholder="openai / dashscope"
            value={provider}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">模型名</Label>
          <Input
            id="model"
            onChange={(event) => setModel(event.target.value)}
            placeholder="gpt-4.1-mini"
            value={model}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            value={apiKey}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          免费初始化次数用完后，会优先使用这里保存的本机模型配置。
        </p>
        <Button size="sm" type="submit">
          保存设置
        </Button>
      </form>
    </section>
  );
}

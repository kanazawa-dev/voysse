"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, PencilLine, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { api, messageFrom } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { PROVIDERS, modelsFor, estimateTokens, modelContextWindow } from "@/lib/providers";
import { Combobox } from "@/components/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIMEZONES } from "@/lib/timezones";
import { agentTemplates, localize } from "@/lib/agent-templates";
import type { Agent, Client } from "@/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const BROWSER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
})();

const STEP_KEYS = ["agents.wizard.s1", "agents.wizard.s2", "agents.wizard.s3", "agents.wizard.s4", "agents.wizard.s5"] as const;

export default function NewAgentPage() {
  const { t, lang } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [busy, setBusy] = useState(false);

  const [templateId, setTemplateId] = useState("");
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [personality, setPersonality] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [timezone, setTimezone] = useState(BROWSER_TZ);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [memoryLimit, setMemoryLimit] = useState(30);

  useEffect(() => {
    const preferred = new URLSearchParams(window.location.search).get("client") || "";
    api<Client[]>("/clients").then((c) => {
      setClients(c);
      setClientId(preferred || c[0]?.id || "");
    }).catch(() => {});
  }, []);

  const promptTokens = useMemo(() => estimateTokens([description, instructions, personality].join("\n")), [description, instructions, personality]);
  const contextWindow = modelContextWindow(model);
  const contextPct = Math.min(100, Math.round((promptTokens / contextWindow) * 100));

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = agentTemplates.find((item) => item.id === id);
    if (tpl) {
      setDescription(localize(tpl.description, lang));
      setInstructions(localize(tpl.instructions, lang));
      setPersonality(localize(tpl.personality, lang));
    }
    setStep(1);
  }

  const canNext = step !== 1 || (name.trim().length > 0 && Boolean(clientId));

  async function create() {
    setBusy(true);
    try {
      const agent = await api<Agent>("/agents", { method: "POST", body: JSON.stringify({
        client_id: clientId, name, description, instructions, personality,
        provider, model: model || "", timezone,
        temperature, max_tokens: maxTokens, memory_limit: memoryLimit, is_active: true,
      }) });
      router.push(`/agents/${agent.id}`);
    } catch (err) { toast.error(messageFrom(err)); setBusy(false); }
  }

  if (!clients.length) {
    return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={17} /> {t("agents.new.back")}</Link>
      <Alert type="info">{t("agents.new.needClient")} <Link href="/clients/new">{t("agents.new.createClient")}</Link></Alert>
    </div>;
  }

  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={17} /> {t("agents.new.back")}</Link>
    <header className="mb-5 flex items-center justify-between gap-4"><span className="mb-1 block text-xs font-medium uppercase tracking-widest text-primary">{t("agents.new.eyebrow")}</span><h1 className="font-heading">{t("agents.new.title")}</h1></header>

    <ol className="grid grid-cols-5 gap-2 text-xs text-muted-foreground">
      {STEP_KEYS.map((key, index) => (
        <li key={key} className={`flex flex-col items-center gap-1 text-center ${index === step ? "font-semibold text-primary" : index < step ? "text-emerald-700" : ""}`}>
          <span>{index < step ? <Check size={14} /> : index + 1}</span>
          <small>{t(key)}</small>
        </li>
      ))}
    </ol>

    <Card className="p-5">
      {step === 0 && <div className="space-y-4">
        <div className="mb-5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("agents.wizard.templatesTitle")}</h2><p>{t("agents.wizard.templatesSubtitle")}</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {agentTemplates.map((tpl) => (
            <Button type="button" variant="outline" key={tpl.id} className={`h-auto justify-start gap-3 rounded-xl p-4 text-left ${templateId === tpl.id ? "border-primary bg-primary/5" : ""}`} onClick={() => applyTemplate(tpl.id)}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><tpl.icon size={20} /></span>
              <span className="min-w-0 whitespace-normal"><strong className="block">{localize(tpl.name, lang)}</strong><small className="block text-muted-foreground">{localize(tpl.tagline, lang)}</small></span>
            </Button>
          ))}
          <Button type="button" variant="outline" className="h-auto justify-start gap-3 rounded-xl p-4 text-left" onClick={() => { setTemplateId(""); setStep(1); }}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PencilLine size={20} /></span>
            <span className="min-w-0 whitespace-normal"><strong className="block">{t("agents.wizard.blankName")}</strong><small className="block text-muted-foreground">{t("agents.wizard.blankTagline")}</small></span>
          </Button>
        </div>
      </div>}

      {step === 1 && <div className="space-y-4">
        <div className="mb-5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("agents.wizard.identityTitle")}</h2><p>{t("agents.wizard.identitySubtitle")}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>{t("agents.new.clientLabel")}</Label><Select items={clients.map((client) => ({ value: client.id, label: client.name }))} value={clientId || null} onValueChange={(value) => setClientId(value ?? "")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="agent-name">{t("agents.new.nameLabel")}</Label><Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder={t("agents.new.namePlaceholder")} /></div>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="agent-description">{t("agents.new.descriptionLabel")}</Label><Textarea id="agent-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("agents.new.descriptionPlaceholder")} /></div>
      </div>}

      {step === 2 && <div className="space-y-4">
        <div className="mb-5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("agents.wizard.promptTitle")}</h2><p>{t("agents.wizard.promptSubtitle")}</p></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="agent-instructions">{t("agents.new.instructionsLabel")}</Label><Textarea id="agent-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={10} placeholder={t("agents.new.instructionsPlaceholder")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="agent-personality">{t("agents.new.personalityLabel")}</Label><Textarea id="agent-personality" value={personality} onChange={(e) => setPersonality(e.target.value)} rows={3} placeholder={t("agents.new.personalityPlaceholder")} /></div>
        <div className="space-y-2"><Progress value={contextPct} /><small className="flex items-center gap-1 text-muted-foreground"><Sparkles size={13} /> {t("agents.wizard.tokens", { count: promptTokens.toLocaleString(lang) })}</small></div>
      </div>}

      {step === 3 && <div className="space-y-4">
        <div className="mb-5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("agents.wizard.modelTitle")}</h2><p>{t("agents.wizard.modelSubtitle")}</p></div>
        <label>{t("agents.detail.timezoneLabel")}<Combobox value={timezone} onChange={setTimezone} options={TIMEZONES} placeholder={t("agents.detail.timezoneLabel")} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>{t("agents.new.providerLabel")}</Label><Select items={PROVIDERS.map((item) => ({ value: item.id, label: item.label }))} value={provider} onValueChange={(value) => value && setProvider(value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PROVIDERS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <label>{t("agents.new.modelLabel")}<Combobox value={model} onChange={setModel} options={modelsFor(provider)} placeholder={t("agents.new.modelPlaceholder")} allowCustom /></label>
        </div>
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3"><Progress value={contextPct} /><small className="flex items-center gap-1 text-muted-foreground"><Sparkles size={12} /> {t("agents.detail.contextUsage", { count: promptTokens.toLocaleString(lang), total: contextWindow.toLocaleString(lang) })}</small></div>
        <div className="space-y-2"><div className="flex justify-between text-sm"><span>{t("agents.detail.temperatureLabel")}</span><strong>{temperature.toFixed(1)}/2</strong></div><input className="block w-full" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} /></div>
        <div className="space-y-2"><div className="flex justify-between text-sm"><span>{t("agents.detail.maxTokensLabel")}</span><strong>{maxTokens}/8192</strong></div><input className="block w-full" type="range" min="256" max="8192" step="256" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /></div>
        <div className="space-y-2"><div className="flex justify-between text-sm"><span>{t("agents.detail.memoryLimitLabel")}</span><strong>{memoryLimit}/100</strong></div><input className="block w-full" type="range" min="0" max="100" step="1" value={memoryLimit} onChange={(e) => setMemoryLimit(Number(e.target.value))} /></div>
      </div>}

      {step === 4 && <div className="space-y-4">
        <div className="mb-5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("agents.wizard.reviewTitle")}</h2><p>{t("agents.wizard.reviewSubtitle")}</p></div>
        <dl className="space-y-2 text-sm">
          <div><dt>{t("agents.new.nameLabel")}</dt><dd>{name || <span className="text-muted-foreground">—</span>}</dd></div>
          <div><dt>{t("agents.new.clientLabel")}</dt><dd>{clients.find((c) => c.id === clientId)?.name || "—"}</dd></div>
          <div><dt>{t("agents.wizard.reviewTemplate")}</dt><dd>{templateId ? localize(agentTemplates.find((x) => x.id === templateId)!.name, lang) : t("agents.wizard.blankName")}</dd></div>
          <div><dt>{t("agents.new.providerLabel")}</dt><dd>{PROVIDERS.find((p) => p.id === provider)?.label || provider}</dd></div>
          <div><dt>{t("agents.new.modelLabel")}</dt><dd>{model || <span className="text-muted-foreground">{t("agents.new.modelPlaceholder")}</span>}</dd></div>
        </dl>
      </div>}
    </Card>

    <div className="mt-6 flex items-center justify-between gap-3">
      <Button type="button" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}><ArrowLeft size={16} /> {t("agents.wizard.back")}</Button>
      <div className="flex-1 space-y-1"><Progress value={((step + 1) / STEP_KEYS.length) * 100} /><span className="block text-center text-xs text-muted-foreground">{t("agents.wizard.stepOf", { n: step + 1, total: STEP_KEYS.length })}</span></div>
      {step < STEP_KEYS.length - 1
        ? <Button type="button" onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}>{t("agents.wizard.next")} <ArrowRight size={16} /></Button>
        : <Button type="button" onClick={create} disabled={busy || !name.trim()}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} {t("agents.new.createAgent")}</Button>}
    </div>
  </div>;
}

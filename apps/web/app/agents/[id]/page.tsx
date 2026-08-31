"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AudioLines, Bot, CheckCircle2, Code, Copy, ExternalLink, FileText, ImageIcon, LoaderCircle, MessageSquareText, Plus, Power, PowerOff, Save, Settings2, Sparkles, Trash2, UploadCloud, Wrench, XCircle } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { ChatPlayground } from "@/components/chat-playground";
import { AgentToolsTab } from "@/components/agent-tools/agent-tools-tab";
import { Combobox } from "@/components/combobox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROVIDERS, modelsFor, estimateTokens, modelContextWindow, AUDIO_MODELS, IMAGE_MODELS } from "@/lib/providers";
import { TIMEZONES } from "@/lib/timezones";
import type { Agent, AgentTool, Client, KnowledgeDocument, QAPair } from "@/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Tab = "details" | "knowledge" | "tools" | "widget" | "playground";

export default function AgentDetailPage() {
  const t = useT();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [memoryLimit, setMemoryLimit] = useState(30);
  const [imageEnabled, setImageEnabled] = useState(false);
  const [imageModel, setImageModel] = useState("gpt-4.1");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioModel, setAudioModel] = useState("whisper-1");
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [widgetGreeting, setWidgetGreeting] = useState("");
  const [widgetColor, setWidgetColor] = useState("#1748c7");
  const [widgetPosition, setWidgetPosition] = useState("right");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [tab, setTab] = useState<Tab>("details");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [a, c, d, q, tl] = await Promise.all([api<Agent>(`/agents/${id}`), api<Client[]>("/clients"), api<KnowledgeDocument[]>(`/agents/${id}/documents`), api<QAPair[]>(`/agents/${id}/qa`), api<AgentTool[]>(`/agents/${id}/tools`)]);
    setAgent(a); setClients(c); setDocuments(d); setQaPairs(q); setTools(tl);
    setProvider(a.provider); setModel(a.model); setTimezone(a.timezone || "UTC");
    setTemperature(a.temperature); setMaxTokens(a.max_tokens); setMemoryLimit(a.memory_limit);
    setImageEnabled(a.image_enabled); setImageModel(a.image_model || "gpt-4.1");
    setAudioEnabled(a.audio_enabled); setAudioModel(a.audio_model || "whisper-1");
    setWidgetEnabled(a.widget_enabled); setWidgetGreeting(a.widget_greeting);
    setWidgetColor(a.widget_color || "#1748c7"); setWidgetPosition(a.widget_position || "right");
  };

  const contextWindow = modelContextWindow(model);
  const promptTokens = useMemo(
    () => (agent ? estimateTokens([agent.description, agent.instructions, agent.personality, agent.brief_summary, agent.brief_products, agent.brief_audience, agent.brief_policies, agent.brief_goal, agent.brief_dos, agent.brief_donts, agent.manual_context].join("\n")) : 0),
    [agent],
  );
  const contextPct = Math.min(100, Math.round((promptTokens / contextWindow) * 100));
  useEffect(() => { load(); }, [id]);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = { client_id: form.get("client_id"), name: form.get("name"), description: form.get("description"), instructions: form.get("instructions"), personality: form.get("personality"), brief_summary: form.get("brief_summary"), brief_products: form.get("brief_products"), brief_audience: form.get("brief_audience"), brief_policies: form.get("brief_policies"), brief_goal: form.get("brief_goal"), brief_dos: form.get("brief_dos"), brief_donts: form.get("brief_donts"), provider, model, timezone, temperature, max_tokens: maxTokens, memory_limit: memoryLimit, image_enabled: imageEnabled, image_model: imageModel, audio_enabled: audioEnabled, audio_model: audioModel };
    try { setAgent(await api<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(payload) })); toast.success(t("agents.detail.configSaved")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  async function togglePublish() {
    if (!agent) return;
    setBusy(true);
    try {
      const updated = await api<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify({ is_active: !agent.is_active }) });
      setAgent(updated);
      toast.success(updated.is_active ? t("agents.detail.publishedNotice") : t("agents.detail.unpublishedNotice"));
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  async function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { setAgent(await api<Agent>(`/agents/${id}/context`, { method: "PUT", body: JSON.stringify({ manual_context: form.get("manual_context") }) })); toast.success(t("agents.detail.manualContextSaved")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  async function saveWidget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const payload = { widget_enabled: widgetEnabled, widget_greeting: widgetGreeting, widget_color: widgetColor, widget_position: widgetPosition };
    try { setAgent(await api<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(payload) })); toast.success(t("agents.detail.widgetSaved")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  const widgetSnippet = agent
    ? `<script src="${typeof window === "undefined" ? "" : window.location.origin}/widget.js" data-agent="${agent.widget_public_id}" data-color="${widgetColor}" data-position="${widgetPosition}" async></script>`
    : "";

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const data = new FormData(); data.append("file", file);
    try { const doc = await api<KnowledgeDocument>(`/agents/${id}/documents`, { method: "POST", body: data }); setDocuments((items) => [doc, ...items]); toast.success(doc.status === "processed" ? t("agents.detail.pdfProcessed") : t("agents.detail.pdfSavedNotProcessed")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function removeDocument(doc: KnowledgeDocument) {
    if (!confirm(t("agents.detail.confirmDelete", { filename: doc.filename }))) return;
    await api(`/agents/${id}/documents/${doc.id}`, { method: "DELETE" });
    setDocuments((items) => items.filter((item) => item.id !== doc.id));
  }

  async function addQA(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const pair = await api<QAPair>(`/agents/${id}/qa`, { method: "POST", body: JSON.stringify({ question: data.get("question"), answer: data.get("answer") }) });
      setQaPairs((items) => [...items, pair]);
      form.reset();
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }
  async function removeQA(pair: QAPair) {
    await api(`/agents/${id}/qa/${pair.id}`, { method: "DELETE" });
    setQaPairs((items) => items.filter((item) => item.id !== pair.id));
  }

  if (!agent) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" /> {t("agents.detail.loading")}</div>;
  return <div className="flex w-full flex-col gap-6">
    <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> {t("agents.detail.back")}</Link>
    <header className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot size={29} /></span><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-heading">{agent.name}</h1><span className={agent.is_active ? "inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary" : "inline-flex rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground"}>{agent.is_active ? t("agents.detail.published") : t("agents.detail.unpublished")}</span></div><p>{agent.client.name} · {agent.description || t("agents.detail.noDescription")}</p></div></div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant={agent.is_active ? "ghost" : "default"} onClick={togglePublish} disabled={busy}>{agent.is_active ? <><PowerOff size={16} /> {t("agents.detail.unpublish")}</> : <><Power size={16} /> {t("agents.detail.publish")}</>}</Button><Button variant="secondary" render={<Link href={`/playground`} />}><MessageSquareText size={17} /> {t("agents.detail.openPlayground")}</Button></div></header>
    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}><TabsList variant="line" className="max-w-full justify-start gap-0.5 overflow-x-auto"><TabsTrigger value="details"><Settings2 size={15} /> {t("agents.detail.tabDetails")}</TabsTrigger><TabsTrigger value="knowledge"><FileText size={15} /> {t("agents.detail.tabKnowledge")} <span>{documents.length}</span></TabsTrigger><TabsTrigger value="tools"><Wrench size={15} /> {t("tools.tab")} <span>{tools.length}</span></TabsTrigger><TabsTrigger value="widget"><Code size={15} /> {t("agents.detail.tabWidget")}</TabsTrigger><TabsTrigger value="playground"><MessageSquareText size={15} /> {t("agents.detail.tabPlayground")}</TabsTrigger></TabsList></Tabs>

    {tab === "details" && <form className="space-y-6" onSubmit={saveConfig}>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.generalHeading")}</h3><p>{t("agents.detail.generalCopy")}</p></div><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label>{t("agents.detail.clientLabel")}</Label><Select name="client_id" items={clients.map((client) => ({ value: client.id, label: client.name }))} defaultValue={agent.client_id}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-col gap-1.5"><Label htmlFor="agent-detail-name">{t("agents.detail.nameLabel")}</Label><Input id="agent-detail-name" name="name" required defaultValue={agent.name} /></div></div><div className="flex flex-col gap-1.5"><Label htmlFor="agent-detail-description">{t("agents.detail.descriptionLabel")}</Label><Textarea id="agent-detail-description" name="description" rows={3} defaultValue={agent.description} /></div></div></Card>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.behaviorHeading")}</h3><p>{t("agents.detail.behaviorCopy")}</p></div><div className="space-y-4"><div className="flex flex-col gap-1.5"><Label htmlFor="agent-detail-instructions">{t("agents.detail.instructionsLabel")}</Label><Textarea id="agent-detail-instructions" name="instructions" rows={8} defaultValue={agent.instructions} placeholder={t("agents.detail.instructionsPlaceholder")} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="agent-detail-personality">{t("agents.detail.personalityLabel")}</Label><Textarea id="agent-detail-personality" name="personality" rows={4} defaultValue={agent.personality} placeholder={t("agents.detail.personalityPlaceholder")} /></div></div></Card>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.briefHeading")}</h3><p>{t("agents.detail.briefCopy")}</p></div><div className="space-y-4">
        <div className="flex flex-col gap-1.5"><Label htmlFor="brief-summary">{t("agents.detail.briefSummaryLabel")}</Label><Textarea id="brief-summary" name="brief_summary" rows={2} defaultValue={agent.brief_summary} placeholder={t("agents.detail.briefSummaryPlaceholder")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label htmlFor="brief-products">{t("agents.detail.briefProductsLabel")}</Label><Textarea id="brief-products" name="brief_products" rows={3} defaultValue={agent.brief_products} placeholder={t("agents.detail.briefProductsPlaceholder")} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="brief-audience">{t("agents.detail.briefAudienceLabel")}</Label><Textarea id="brief-audience" name="brief_audience" rows={3} defaultValue={agent.brief_audience} placeholder={t("agents.detail.briefAudiencePlaceholder")} /></div>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="brief-policies">{t("agents.detail.briefPoliciesLabel")}</Label><Textarea id="brief-policies" name="brief_policies" rows={3} defaultValue={agent.brief_policies} placeholder={t("agents.detail.briefPoliciesPlaceholder")} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="brief-goal">{t("agents.detail.briefGoalLabel")}</Label><Textarea id="brief-goal" name="brief_goal" rows={2} defaultValue={agent.brief_goal} placeholder={t("agents.detail.briefGoalPlaceholder")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label htmlFor="brief-dos">{t("agents.detail.briefDosLabel")}</Label><Textarea id="brief-dos" name="brief_dos" rows={3} defaultValue={agent.brief_dos} placeholder={t("agents.detail.briefDosPlaceholder")} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="brief-donts">{t("agents.detail.briefDontsLabel")}</Label><Textarea id="brief-donts" name="brief_donts" rows={3} defaultValue={agent.brief_donts} placeholder={t("agents.detail.briefDontsPlaceholder")} /></div>
        </div>
      </div></Card>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.aiModelHeading")}</h3><p>{t("agents.detail.aiModelCopy")}</p></div><div className="space-y-4">
        <label>{t("agents.detail.timezoneLabel")}<Combobox value={timezone} onChange={setTimezone} options={TIMEZONES} placeholder={t("agents.detail.timezoneLabel")} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label>{t("agents.detail.providerLabel")}</Label><Select items={PROVIDERS.map((item) => ({ value: item.id, label: item.label }))} value={provider} onValueChange={(value) => value && setProvider(value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PROVIDERS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div><label>{t("agents.detail.modelLabel")}<Combobox value={model} onChange={setModel} options={modelsFor(provider)} placeholder={t("agents.detail.modelPlaceholder")} allowCustom /></label></div>
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3"><Progress value={contextPct} /><small className="flex items-center gap-1 text-muted-foreground"><Sparkles size={12} /> {t("agents.detail.contextUsage", { count: promptTokens.toLocaleString("es"), total: contextWindow.toLocaleString("es") })}</small></div>
        <Alert type="info">{t("agents.detail.providerKeysPrefix")}<Link href="/settings">{t("agents.detail.settingsLink")}</Link>.</Alert>
        <div className="space-y-2"><div className="flex justify-between text-sm"><span>{t("agents.detail.temperatureLabel")}</span><strong>{temperature.toFixed(1)}/2</strong></div><input className="block w-full" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} /><span className="mt-1.5 block text-xs text-muted-foreground">{t("agents.detail.temperatureHint")}</span></div>
        <div className="space-y-2"><div className="flex justify-between text-sm"><span>{t("agents.detail.maxTokensLabel")}</span><strong>{maxTokens}/8192</strong></div><input className="block w-full" type="range" min="256" max="8192" step="256" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} /><span className="mt-1.5 block text-xs text-muted-foreground">{t("agents.detail.maxTokensHint")}</span></div>
        <div className="space-y-2"><div className="flex justify-between text-sm"><span>{t("agents.detail.memoryLimitLabel")}</span><strong>{memoryLimit}/100</strong></div><input className="block w-full" type="range" min="0" max="100" step="1" value={memoryLimit} onChange={(e) => setMemoryLimit(Number(e.target.value))} /><span className="mt-1.5 block text-xs text-muted-foreground">{t("agents.detail.memoryLimitHint")}</span></div>
      </div></Card>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.capabilitiesHeading")}</h3><p>{t("agents.detail.capabilitiesCopy")}</p></div><div className="space-y-4">
        <div className="rounded-lg border p-4">
          <label className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><ImageIcon size={17} className="shrink-0" /><span><strong>{t("agents.detail.imageLabel")}</strong><small>{t("agents.detail.imageHint")}</small></span></span><Switch checked={imageEnabled} onCheckedChange={setImageEnabled} /></label>
          {imageEnabled && <label className="mt-3">{t("agents.detail.modelLabel")}<Combobox value={imageModel} onChange={setImageModel} options={IMAGE_MODELS} placeholder="gpt-4.1" allowCustom /></label>}
        </div>
        <div className="rounded-lg border p-4">
          <label className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><AudioLines size={17} className="shrink-0" /><span><strong>{t("agents.detail.audioLabel")}</strong><small>{t("agents.detail.audioHint")}</small></span></span><Switch checked={audioEnabled} onCheckedChange={setAudioEnabled} /></label>
          {audioEnabled && <label className="mt-3">{t("agents.detail.modelLabel")}<Combobox value={audioModel} onChange={setAudioModel} options={AUDIO_MODELS} placeholder="whisper-1" allowCustom /></label>}
        </div>
        <Alert type="info">{t("agents.detail.capabilitiesOpenAI")}</Alert>
      </div></Card>
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur"><span className="text-sm text-muted-foreground">{t("agents.detail.stickyNote")}</span><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} {t("agents.detail.saveConfig")}</Button></div>
    </form>}

    {tab === "knowledge" && <><div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card><form className="space-y-4 px-5" onSubmit={saveContext}><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("agents.detail.manualContextHeading")}</h3><p>{t("agents.detail.manualContextCopy")}</p></div></div><Textarea name="manual_context" rows={12} defaultValue={agent.manual_context} placeholder={t("agents.detail.manualContextPlaceholder")} /><div className="flex flex-wrap items-center justify-between gap-2"><small className="text-muted-foreground">{t("agents.detail.charsSaved", { count: agent.manual_context.length.toLocaleString("es") })}</small><Button type="submit" variant="secondary" disabled={busy}><Save size={16} /> {t("agents.detail.saveContext")}</Button></div></form></Card>
      <Card className="p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("agents.detail.pdfHeading")}</h3><p>{t("agents.detail.pdfCopy")}</p></div></div>
        <Button type="button" variant="outline" className="min-h-32 w-full flex-col border-dashed p-5 text-center text-muted-foreground" onClick={() => fileRef.current?.click()} disabled={busy}><span><UploadCloud size={24} /></span><strong>{busy ? t("agents.detail.processing") : t("agents.detail.uploadPdf")}</strong><small>{t("agents.detail.uploadHint")}</small></Button><input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <div className="divide-y">{documents.map((doc) => <div className="flex items-center gap-3 py-3" key={doc.id}><span className={`flex size-9 items-center justify-center rounded-lg ${doc.status === "processed" ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}><FileText size={19} /></span><div><strong>{doc.filename}</strong><small>{doc.status === "processed" ? t("agents.detail.charsExtracted", { count: doc.character_count.toLocaleString("es") }) : doc.error_message}</small></div><span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${doc.status === "processed" ? "text-emerald-700" : "text-destructive"}`}>{doc.status === "processed" ? <><CheckCircle2 size={14} /> {t("agents.detail.processed")}</> : <><XCircle size={14} /> {t("agents.detail.error")}</>}</span><Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeDocument(doc)} title={t("agents.detail.delete")}><Trash2 size={16} /></Button></div>)}{!documents.length && <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><FileText size={22} /><div><strong className="block">{t("agents.detail.noDocumentsTitle")}</strong><span className="block">{t("agents.detail.noDocumentsHint")}</span></div></div>}</div>
      </Card>
    </div>
    <Card className="p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><div><h3 className="font-heading">{t("agents.detail.qaHeading")}</h3><p>{t("agents.detail.qaCopy")}</p></div></div>
      <form className="space-y-3 rounded-xl border bg-card p-5" onSubmit={addQA}><Input name="question" required placeholder={t("agents.detail.qaQuestionPlaceholder")} /><Textarea name="answer" rows={2} required placeholder={t("agents.detail.qaAnswerPlaceholder")} /><Button type="submit" variant="secondary" disabled={busy}><Plus size={15} /> {t("agents.detail.qaAdd")}</Button></form>
      <div className="space-y-3">{qaPairs.map((pair) => <div className="rounded-xl border bg-card p-4 [&_p]:mt-2 [&_p]:text-sm [&_p]:text-muted-foreground" key={pair.id}><div><strong>{pair.question}</strong><small>{pair.answer}</small></div><Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeQA(pair)} title={t("agents.detail.delete")}><Trash2 size={16} /></Button></div>)}{!qaPairs.length && <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><MessageSquareText size={22} /><div><strong>{t("agents.detail.qaEmpty")}</strong></div></div>}</div>
    </Card></>}

    {tab === "tools" && <AgentToolsTab agentId={id} tools={tools} onToolsChange={setTools} />}

    {tab === "widget" && <form className="space-y-6" onSubmit={saveWidget}>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.widgetHeading")}</h3><p>{t("agents.detail.widgetCopy")}</p></div><div className="space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-lg border p-3 [&_p]:text-sm [&_p]:text-muted-foreground"><span><strong>{t("agents.detail.widgetEnable")}</strong><small>{t("agents.detail.widgetEnableHint")}</small></span><Switch checked={widgetEnabled} onCheckedChange={setWidgetEnabled} /></label>
        <div className="flex flex-col gap-1.5"><Label htmlFor="widget-greeting">{t("agents.detail.widgetGreeting")}</Label><Textarea id="widget-greeting" rows={2} value={widgetGreeting} onChange={(e) => setWidgetGreeting(e.target.value)} placeholder={t("agents.detail.widgetGreetingPlaceholder")} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>{t("agents.detail.widgetColor")}<div className="flex items-center gap-2 [&_input[type=color]]:size-10 [&_input[type=color]]:rounded-lg [&_input[type=color]]:border [&_input[type=color]]:p-1"><input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} /><Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} /></div></label>
          <div className="grid gap-1.5"><Label>{t("agents.detail.widgetPosition")}</Label><Select items={[{ value: "right", label: t("agents.detail.widgetPositionRight") }, { value: "left", label: t("agents.detail.widgetPositionLeft") }]} value={widgetPosition} onValueChange={(value) => value && setWidgetPosition(value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">{t("agents.detail.widgetPositionRight")}</SelectItem><SelectItem value="left">{t("agents.detail.widgetPositionLeft")}</SelectItem></SelectContent></Select></div>
        </div>
      </div></Card>
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h3 className="font-heading">{t("agents.detail.widgetEmbedHeading")}</h3><p>{t("agents.detail.widgetEmbedCopy")}</p></div><div className="space-y-4">
        {widgetEnabled ? <>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{widgetSnippet}</pre>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => { navigator.clipboard.writeText(widgetSnippet); toast.success(t("agents.detail.widgetCopied")); }}><Copy size={15} /> {t("agents.detail.widgetCopy2")}</Button><Button variant="ghost" render={<a href={`/widget/${agent.widget_public_id}`} target="_blank" rel="noreferrer" />}><ExternalLink size={15} /> {t("agents.detail.widgetPreview")}</Button></div>
        </> : <Alert type="info">{t("agents.detail.widgetEnableFirst")}</Alert>}
      </div></Card>
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur"><span className="text-sm text-muted-foreground">{t("agents.detail.stickyNote")}</span><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} {t("agents.detail.saveConfig")}</Button></div>
    </form>}

    {tab === "playground" && <ChatPlayground lockedAgentId={agent.id} />}
  </div>;
}

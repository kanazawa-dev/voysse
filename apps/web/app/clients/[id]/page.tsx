"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BarChart3, Bot, Copy, ExternalLink, Facebook, Globe2, Inbox, Instagram, LoaderCircle, MessageCircle, QrCode, Radio, Save, Settings2, ShieldAlert, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Client, ClientDomain, ClientUsage, Conversation } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Tab = "details" | "agents" | "channels" | "inbox" | "portal" | "usage";

export default function ClientDetailPage() {
  const t = useT();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [busy, setBusy] = useState(false);
  const load = () => api<Client>(`/clients/${id}`).then(setClient);
  useEffect(() => { load(); }, [id]);

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    try { setClient(await api<Client>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify({ name: data.get("name"), industry: data.get("industry"), description: data.get("description"), general_context: data.get("general_context"), is_active: data.get("is_active") === "on" }) })); toast.success(t("clients.detail.detailsSaved")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  async function savePortal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { portal_enabled: data.get("portal_enabled") === "on", portal_slug: data.get("portal_slug"), portal_title: data.get("portal_title"), portal_email: data.get("portal_email") || null };
    if (data.get("portal_password")) payload.portal_password = data.get("portal_password");
    try { setClient(await api<Client>(`/clients/${id}/portal`, { method: "PATCH", body: JSON.stringify(payload) })); toast.success(t("clients.detail.portalUpdated")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  async function remove() {
    if (!client || !confirm(t("clients.detail.confirmDelete", { name: client.name }))) return;
    await api(`/clients/${id}`, { method: "DELETE" }); router.push("/clients");
  }

  if (!client) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" /> {t("clients.detail.loading")}</div>;
  const portalUrl = `${typeof window === "undefined" ? "http://localhost:3000" : window.location.origin}/portal/${client.portal_slug}`;
  return <div className="flex w-full flex-col gap-6">
    <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={17} /> {t("clients.detail.back")}</Link>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{client.name.slice(0, 2).toUpperCase()}</div><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-heading">{client.name}</h1><StatusBadge active={client.is_active} /></div><p>{client.industry || t("clients.detail.industryUndefined")} · {client.agents.length === 1 ? t("clients.detail.agentOne", { count: client.agents.length }) : t("clients.detail.agentMany", { count: client.agents.length })}</p></div><div className="flex flex-wrap items-center gap-2 sm:ml-auto"><Button render={<Link href={`/agents/new?client=${client.id}`} />}><Bot size={17} /> {t("clients.detail.newAgent")}</Button></div></header>
    <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}><TabsList variant="line" className="max-w-full justify-start gap-0.5 overflow-x-auto"><TabsTrigger value="details"><Settings2 size={15} /> {t("clients.detail.tabDetails")}</TabsTrigger><TabsTrigger value="agents"><Bot size={15} /> {t("clients.detail.tabAgents")} <span>{client.agents.length}</span></TabsTrigger><TabsTrigger value="channels"><Radio size={15} /> {t("clients.detail.tabChannels")}</TabsTrigger><TabsTrigger value="inbox"><Inbox size={15} /> {t("clients.detail.tabInbox")}</TabsTrigger><TabsTrigger value="portal"><Globe2 size={15} /> {t("clients.detail.tabPortal")}</TabsTrigger><TabsTrigger value="usage"><BarChart3 size={15} /> {t("clients.detail.tabUsage")}</TabsTrigger></TabsList></Tabs>

    {tab === "details" && <form className="mx-auto flex w-full max-w-5xl flex-col gap-6" onSubmit={saveDetails}><Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("clients.detail.clientInfo")}</h2><p>{t("clients.detail.clientInfoCopy")}</p></div><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><Label htmlFor="client-detail-name">{t("clients.detail.name")}</Label><Input id="client-detail-name" name="name" required defaultValue={client.name} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="client-detail-industry">{t("clients.detail.industry")}</Label><Input id="client-detail-industry" name="industry" defaultValue={client.industry} /></div></div><div className="flex flex-col gap-1.5"><Label htmlFor="client-detail-description">{t("clients.detail.descriptionLabel")}</Label><Textarea id="client-detail-description" name="description" rows={3} defaultValue={client.description} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="client-detail-context">{t("clients.detail.generalContext")}</Label><Textarea id="client-detail-context" name="general_context" rows={9} defaultValue={client.general_context} /><span className="mt-1.5 text-xs text-muted-foreground">{t("clients.detail.generalContextHelp")}</span></div><label className="flex items-center justify-between gap-4 rounded-lg border p-3 [&_p]:text-sm [&_p]:text-muted-foreground"><span><strong className="block">{t("clients.detail.activeClient")}</strong><small className="block text-muted-foreground">{t("clients.detail.activeClientHint")}</small></span><Switch name="is_active" defaultChecked={client.is_active} /></label></div></Card><div className="flex flex-wrap items-center justify-between gap-2 border-t pt-5"><Button type="button" variant="destructive" onClick={remove}><Trash2 size={16} /> {t("clients.detail.deleteClient")}</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} {t("clients.detail.saveChanges")}</Button></div></form>}

    {tab === "agents" && (client.agents.length ? <Card><Table><TableHeader><TableRow><TableHead>{t("clients.detail.colAgent")}</TableHead><TableHead>{t("clients.detail.colFunction")}</TableHead><TableHead>{t("clients.detail.colStatus")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{client.agents.map((agent) => <TableRow key={agent.id}><TableCell><Link className="flex items-center gap-3" href={`/agents/${agent.id}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot size={18} /></span><strong>{agent.name}</strong></Link></TableCell><TableCell>{agent.description || t("clients.detail.noDescription")}</TableCell><TableCell><StatusBadge active={agent.is_active} /></TableCell><TableCell><Link className="text-muted-foreground" href={`/agents/${agent.id}`}><ArrowRight size={17} /></Link></TableCell></TableRow>)}</TableBody></Table></Card> : <EmptyState icon={<Bot />} title={t("clients.detail.agentsEmptyTitle")} description={t("clients.detail.agentsEmptyDescription")} action={<Button render={<Link href={`/agents/new?client=${client.id}`} />}>{t("clients.detail.createAgent")}</Button>} />)}

    {tab === "channels" && <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><MessageCircle size={21} /></span>
          <div className="min-w-0 flex-1"><CardTitle>{t("channels.whatsappCloud.title")}</CardTitle><CardDescription className="mt-1 leading-relaxed">{t("clients.detail.channelWhatsappAvailable", { name: client.name })}</CardDescription></div>
          <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />{t("clients.detail.channelAvailable")}</Badge>
        </CardHeader>
        <CardContent className="mt-auto flex justify-end pt-1"><Button className="w-full sm:w-auto" variant="secondary" render={<Link href={`/clients/${client.id}/channels/whatsapp-cloud`} />}>{t("clients.detail.configure")} <ArrowRight size={15} /></Button></CardContent>
      </Card>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><QrCode size={21} /></span>
          <div className="min-w-0 flex-1"><CardTitle>{t("channels.whatsapp.title")}</CardTitle><CardDescription className="mt-1 leading-relaxed">{t("clients.detail.channelWhatsappAvailable", { name: client.name })}</CardDescription></div>
          <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />{t("clients.detail.channelAvailable")}</Badge>
        </CardHeader>
        <CardContent className="mt-auto flex justify-end pt-1"><Button className="w-full sm:w-auto" variant="secondary" render={<Link href={`/clients/${client.id}/channels/whatsapp`} />}>{t("clients.detail.configure")} <ArrowRight size={15} /></Button></CardContent>
      </Card>
      {[
        { name: "Instagram", icon: Instagram },
        { name: "Facebook Messenger", icon: Facebook },
        { name: "Webchat", icon: Globe2 },
      ].map(({ name, icon: Icon }) => <Card className="h-full bg-muted/20" key={name}>
        <CardHeader className="flex flex-row items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon size={21} /></span>
          <div className="min-w-0 flex-1"><CardTitle>{name}</CardTitle><CardDescription className="mt-1 leading-relaxed">{t("clients.detail.comingSoon")}</CardDescription></div>
          <Badge variant="outline" className="text-muted-foreground">{t("clients.detail.comingSoon")}</Badge>
        </CardHeader>
        <CardContent className="mt-auto flex justify-end pt-1"><Button className="w-full sm:w-auto" type="button" variant="secondary" disabled>{t("clients.detail.connect")}</Button></CardContent>
      </Card>)}
    </section>}

    {tab === "inbox" && <ClientInbox clientId={client.id} />}

    {tab === "usage" && <ClientUsageView clientId={client.id} />}

    {tab === "portal" && <><form className="mx-auto flex w-full max-w-5xl flex-col gap-6" onSubmit={savePortal}><Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("clients.detail.portalTitle")}</h2><p>{t("clients.detail.portalCopy")}</p></div><div className="space-y-4"><div className="flex flex-col gap-1.5"><Label htmlFor="portal-title">{t("clients.detail.portalTitleLabel")}</Label><Input id="portal-title" name="portal_title" defaultValue={client.portal_title} placeholder={t("clients.detail.portalTitlePlaceholder", { name: client.name })} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="portal-slug">{t("clients.detail.portalUrl")}</Label><div className="flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/30 [&>span]:pl-3 [&>span]:text-sm [&>span]:text-muted-foreground [&_input]:border-0 [&_input]:shadow-none"><span>localhost:3000/portal/</span><Input id="portal-slug" name="portal_slug" defaultValue={client.portal_slug} /></div></div><div className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs"><code>{portalUrl}</code><Button type="button" size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(portalUrl)}><Copy size={15} /> {t("clients.detail.copy")}</Button>{client.portal_enabled && <Button size="sm" variant="ghost" render={<a href={portalUrl} target="_blank" rel="noreferrer" />}><ExternalLink size={15} /> {t("clients.detail.open")}</Button>}</div><div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><Label htmlFor="portal-email">{t("clients.detail.portalEmail")}</Label><Input id="portal-email" name="portal_email" type="email" defaultValue={client.portal_email || ""} placeholder={t("clients.detail.portalEmailPlaceholder")} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="portal-password">{t("clients.detail.portalPassword")}</Label><Input id="portal-password" name="portal_password" type="password" autoComplete="new-password" placeholder={client.portal_password_configured ? t("clients.detail.portalPasswordKeep") : t("clients.detail.portalPasswordMin")} /></div></div><label className="flex items-center justify-between gap-4 rounded-lg border p-3 [&_p]:text-sm [&_p]:text-muted-foreground"><span><strong className="block">{t("clients.detail.publishPortal")}</strong><small className="block text-muted-foreground">{t("clients.detail.publishPortalHint")}</small></span><Switch name="portal_enabled" defaultChecked={client.portal_enabled} /></label></div></Card><div className="flex flex-wrap justify-end gap-2 border-t pt-5"><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} {t("clients.detail.savePortal")}</Button></div></form><PortalDomain clientId={client.id} /></>}
  </div>;
}

function ClientUsageView({ clientId }: { clientId: string }) {
  const t = useT();
  const [usage, setUsage] = useState<ClientUsage | null>(null);
  const [days, setDays] = useState(30);
  useEffect(() => { api<ClientUsage>(`/clients/${clientId}/usage?days=${days}`).then(setUsage); }, [clientId, days]);

  const maxUsage = Math.max(1, ...(usage?.usage_by_model.map((item) => item.input_tokens + item.output_tokens) ?? [0]));

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{t("clients.detail.usageSubtitle")}</p>
      <Select value={String(days)} onValueChange={(value) => value && setDays(Number(value))}>
        <SelectTrigger className="w-40"><SelectValue>{t("clients.detail.usageRangeDays", { count: days })}</SelectValue></SelectTrigger>
        <SelectContent>{[7, 14, 30, 90].map((d) => <SelectItem key={d} value={String(d)}>{t("clients.detail.usageRangeDays", { count: d })}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <section className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-2xl [&_strong]:font-semibold"><small>{t("clients.detail.usageMessages")}</small><strong>{usage?.messages ?? "—"}</strong></Card>
      <Card className="p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-2xl [&_strong]:font-semibold"><small>{t("clients.detail.usageTokens")}</small><strong>{usage ? (usage.tokens_in + usage.tokens_out).toLocaleString() : "—"}</strong><p className="mt-1 text-xs text-muted-foreground">↓ {(usage?.tokens_in ?? 0).toLocaleString()} · ↑ {(usage?.tokens_out ?? 0).toLocaleString()}</p></Card>
      <Card className="p-5 [&_small]:text-sm [&_small]:text-muted-foreground [&_strong]:mt-1 [&_strong]:block [&_strong]:text-2xl [&_strong]:font-semibold">
        <small>{t("clients.detail.usageCost")}</small>
        <strong>{usage?.estimated_cost_usd != null ? `$${usage.estimated_cost_usd.toFixed(2)}` : "—"}</strong>
        {usage && usage.estimated_cost_usd == null && <p className="mt-1 text-xs text-muted-foreground">{t("clients.detail.usageCostUnsetHint")}</p>}
      </Card>
    </section>
    <Card className="p-5">
      <h3 className="font-heading">{t("clients.detail.usageByModel")}</h3>
      {usage?.usage_by_model.length ? (
        <div className="mt-4 space-y-3">
          {usage.usage_by_model.map((item) => {
            const total = item.input_tokens + item.output_tokens;
            return <div className="grid items-center gap-3 text-sm sm:grid-cols-[minmax(8rem,1fr)_3fr_auto]" key={item.model}><strong>{item.model}</strong><Progress value={Math.round((total / maxUsage) * 100)} /><span className="text-xs tabular-nums text-muted-foreground">{total.toLocaleString()} tok</span></div>;
          })}
        </div>
      ) : <div className="mt-4 flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><BarChart3 size={22} /><div><strong>{t("clients.detail.usageEmpty")}</strong></div></div>}
    </Card>
  </div>;
}

function PortalDomain({ clientId }: { clientId: string }) {
  const t = useT();
  const toast = useToast();
  const [domain, setDomain] = useState<ClientDomain | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<ClientDomain>(`/clients/${clientId}/domain`).then((d) => { setDomain(d); setInput(d.domain || ""); }); }, [clientId]);

  async function save() {
    setBusy(true);
    try { const d = await api<ClientDomain>(`/clients/${clientId}/domain`, { method: "PUT", body: JSON.stringify({ domain: input.trim().toLowerCase() }) }); setDomain(d); toast.success(t("clients.detail.domainSaved")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true);
    try { const d = await api<ClientDomain>(`/clients/${clientId}/domain/verify`, { method: "POST" }); setDomain(d); toast.success(t("clients.detail.domainVerified")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { const d = await api<ClientDomain>(`/clients/${clientId}/domain`, { method: "DELETE" }); setDomain(d); setInput(""); toast.success(t("clients.detail.domainRemoved")); }
    catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  return <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr] space-y-4"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("clients.detail.domainTitle")}</h2><p>{t("clients.detail.domainCopy")}</p></div><div className="space-y-4">
    <label>{t("clients.detail.domainLabel")}<div className="flex gap-2"><Globe2 size={16} /><Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="chat.brand.com" /><Button type="button" variant="secondary" onClick={save} disabled={busy || !input.trim()}><Save size={15} /> {t("clients.detail.domainSave")}</Button></div></label>
    {domain?.domain && <>
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${domain.verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{domain.verified ? <><ShieldCheck size={16} /> {t("clients.detail.domainStatusVerified")}</> : <><ShieldAlert size={16} /> {t("clients.detail.domainStatusPending")}</>}</div>
      {!domain.verified && <div className="space-y-4">
        <p>{t("clients.detail.domainDnsIntro")}</p>
        <Table><TableHeader><TableRow><TableHead>{t("clients.detail.domainDnsType")}</TableHead><TableHead>{t("clients.detail.domainDnsHost")}</TableHead><TableHead>{t("clients.detail.domainDnsValue")}</TableHead></TableRow></TableHeader><TableBody>
          <TableRow><TableCell>CNAME</TableCell><TableCell><code>{domain.domain}</code></TableCell><TableCell><code>{t("clients.detail.domainCnameTarget")}</code></TableCell></TableRow>
          <TableRow><TableCell>TXT</TableCell><TableCell><code>{domain.txt_host}</code></TableCell><TableCell><code>{domain.txt_value}</code></TableCell></TableRow>
        </TableBody></Table>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={verify} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <ShieldCheck size={15} />} {t("clients.detail.domainVerify")}</Button></div>
      </div>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-5"><Button type="button" variant="destructive" onClick={remove} disabled={busy}><Trash2 size={15} /> {t("clients.detail.domainRemove")}</Button></div>
    </>}
  </div></Card>;
}

function ClientInbox({ clientId }: { clientId: string }) {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { const rows = await api<Conversation[]>(`/conversations?client_id=${clientId}`); setItems(rows); if (rows[0] && !selected) setSelected(await api<Conversation>(`/conversations/${rows[0].id}`)); };
  useEffect(() => { load(); }, [clientId]);
  async function choose(item: Conversation) { setSelected(await api<Conversation>(`/conversations/${item.id}`)); }
  async function mode(next: "ai" | "human") { if (!selected) return; setSelected(await api<Conversation>(`/conversations/${selected.id}/mode`, { method: "PATCH", body: JSON.stringify({ mode: next }) })); await load(); }
  async function reply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget; const data = new FormData(form); setBusy(true); try { setSelected(await api<Conversation>(`/conversations/${selected.id}/reply`, { method: "POST", body: JSON.stringify({ content: data.get("content") }) })); form.reset(); await load(); } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); } }
  if (!items.length) return <EmptyState icon={<Inbox />} title={t("clients.detail.inboxEmptyTitle")} description={t("clients.detail.inboxEmptyDescription")} />;
  return <div className="grid min-h-[calc(100vh-7rem)] overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[22rem_1fr]"><aside className="divide-y"><header><strong>{t("clients.detail.conversations")}</strong><span>{items.length}</span></header>{items.map((item) => <Button type="button" variant="ghost" key={item.id} className={`h-auto w-full justify-start rounded-none border-b px-3 py-3 text-left ${selected?.id === item.id ? "bg-muted text-foreground" : "text-muted-foreground"}`} onClick={() => choose(item)}><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound size={15} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-foreground">{item.title}</strong><small className="block truncate text-xs text-muted-foreground">{item.channel} · {item.mode === "human" ? t("clients.detail.modeHuman") : t("clients.detail.modeAi")}</small></span></Button>)}</aside><section className="flex min-h-0 flex-col">{selected && <><header><div><strong>{selected.title}</strong><small>{selected.channel}</small></div><Button type="button" variant="outline" className={selected.mode === "human" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-primary/20 bg-primary/10 text-primary"} onClick={() => mode(selected.mode === "ai" ? "human" : "ai")}>{selected.mode === "ai" ? t("clients.detail.takeControl") : t("clients.detail.returnToAi")}</Button></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">{selected.messages?.map((message) => <div key={message.id} className={`flex max-w-[80%] gap-2 rounded-xl bg-background p-3 shadow-sm ${message.role === "assistant" ? "mr-auto" : "ml-auto bg-primary text-primary-foreground"}`}><small>{message.sender_name || (message.role === "assistant" ? t("clients.detail.senderAgent") : t("clients.detail.senderVisitor"))}</small><p>{message.content}</p></div>)}</div><form className="border-t p-3" onSubmit={reply}><Input name="content" placeholder={selected.mode === "human" ? t("clients.detail.composerHuman") : t("clients.detail.composerLocked")} disabled={selected.mode !== "human" || busy} required /><Button type="submit" disabled={selected.mode !== "human" || busy}>{t("clients.detail.send")}</Button></form></>}</section></div>;
}

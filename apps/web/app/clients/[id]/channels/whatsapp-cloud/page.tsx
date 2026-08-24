"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Bot, CheckCircle2, CircleAlert, ClipboardCopy, KeyRound, LoaderCircle, Plug, Power, RefreshCw, ShieldCheck, Smartphone, Webhook } from "lucide-react";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError, messageFrom } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import type { Client, WhatsAppCloudChannel } from "@/types";
import { Card } from "@/components/ui/card";

const stateKeys: Record<WhatsAppCloudChannel["status"], { label: I18nKey; copy: I18nKey }> = {
  disconnected: { label: "clients.whatsappCloud.statusDisconnectedLabel", copy: "clients.whatsappCloud.statusDisconnectedCopy" },
  connected: { label: "clients.whatsappCloud.statusConnectedLabel", copy: "clients.whatsappCloud.statusConnectedCopy" },
  error: { label: "clients.whatsappCloud.statusErrorLabel", copy: "clients.whatsappCloud.statusErrorCopy" },
};

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <div className="flex gap-2">
    <div className="flex flex-col gap-1.5"><Label>{label}</Label><Input readOnly value={value} onFocus={(event) => event.currentTarget.select()} /></div>
    <Button type="button" variant="secondary" onClick={copy}><ClipboardCopy size={15} /> {copied ? t("clients.whatsappCloud.copied") : t("clients.whatsappCloud.copy")}</Button>
  </div>;
}

export default function WhatsAppCloudChannelPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [channel, setChannel] = useState<WhatsAppCloudChannel | null>(null);
  const [agentId, setAgentId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadChannel = api<WhatsAppCloudChannel>(`/whatsapp-cloud/channels/${id}`)
      .then((current) => {
        setChannel(current);
        setAgentId(current.agent_id);
        setPhoneNumberId(current.phone_number_id);
        setWabaId(current.waba_id || "");
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
        setChannel(null);
      });
    Promise.all([
      api<Client>(`/clients/${id}`).then((item) => { setClient(item); setAgentId((value) => value || item.agents[0]?.id || ""); }),
      loadChannel,
    ]).catch((err) => setError(messageFrom(err))).finally(() => setLoading(false));
  }, [id]);

  async function save(): Promise<WhatsAppCloudChannel | null> {
    if (!agentId) return null;
    const payload: Record<string, string> = { agent_id: agentId, phone_number_id: phoneNumberId.trim(), waba_id: wabaId.trim() };
    if (accessToken.trim()) payload.access_token = accessToken.trim();
    if (appSecret.trim()) payload.app_secret = appSecret.trim();
    const saved = await api<WhatsAppCloudChannel>(`/whatsapp-cloud/channels/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    setChannel(saved);
    setAccessToken("");
    setAppSecret("");
    return saved;
  }

  async function saveOnly() {
    setBusy(true); setError("");
    try { await save(); } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function saveAndConnect() {
    setBusy(true); setError("");
    try {
      if (await save()) setChannel(await api<WhatsAppCloudChannel>(`/whatsapp-cloud/channels/${id}/connect`, { method: "POST" }));
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!confirm(t("clients.whatsappCloud.confirmDisconnect"))) return;
    setBusy(true); setError("");
    try { setChannel(await api<WhatsAppCloudChannel>(`/whatsapp-cloud/channels/${id}/disconnect`, { method: "POST" })); }
    catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  if (loading || !client) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" /> {t("clients.whatsappCloud.loading")}</div>;
  const state = stateKeys[channel?.status || "disconnected"];
  const canConnect = Boolean(agentId && phoneNumberId.trim() && !busy);
  return <div className="flex w-full flex-col gap-6">
    <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={17} /> {t("clients.whatsapp.back", { name: client.name })}</Link>
    <header className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center"><div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><BadgeCheck size={26} /></div><div><span>{t("clients.whatsapp.channelOf", { name: client.name })}</span><h1 className="font-heading">{t("clients.whatsappCloud.title")}</h1><p>{t("clients.whatsappCloud.headerCopy")}</p></div>{channel && <div className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${channel.status === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : channel.status === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted text-muted-foreground"}`}>{channel.status === "connected" ? <CheckCircle2 size={17} /> : channel.status === "error" ? <CircleAlert size={17} /> : <RefreshCw size={17} />} {t(state.label)}</div>}</header>
    {error && <Alert>{error}</Alert>}
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><main>
      <Card className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><span><Bot size={19} /></span><div><h2 className="font-heading">{t("clients.whatsapp.assignedAgent")}</h2><p>{t("clients.whatsapp.assignedAgentCopy")}</p></div></div><div className="flex items-center gap-3"><div className="grid min-w-64 gap-1.5"><Label>{t("clients.whatsapp.agentToRespond")}</Label><Select value={agentId || null} onValueChange={(value) => setAgentId(value ?? "")} disabled={busy}><SelectTrigger className="w-full"><SelectValue placeholder={t("clients.whatsapp.selectAgent")} /></SelectTrigger><SelectContent>{client.agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}{agent.is_active ? "" : t("clients.whatsapp.inactiveSuffix")}</SelectItem>)}</SelectContent></Select></div></div>{!client.agents.length && <Alert>{t("clients.whatsapp.needsAgent")}</Alert>}</Card>
      <Card className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><span><KeyRound size={19} /></span><div><h2 className="font-heading">{t("clients.whatsappCloud.credentialsTitle")}</h2><p>{t("clients.whatsappCloud.credentialsCopy")}</p></div></div>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5"><Label htmlFor="wa-phone-number-id">{t("clients.whatsappCloud.phoneNumberIdLabel")}</Label><Input id="wa-phone-number-id" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} disabled={busy} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="wa-waba-id">{t("clients.whatsappCloud.wabaIdLabel")}</Label><Input id="wa-waba-id" value={wabaId} onChange={(event) => setWabaId(event.target.value)} disabled={busy} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="wa-access-token">{t("clients.whatsappCloud.accessTokenLabel")}</Label><Input id="wa-access-token" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={channel?.has_access_token ? t("clients.whatsappCloud.secretSavedPlaceholder") : ""} disabled={busy} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="wa-app-secret">{t("clients.whatsappCloud.appSecretLabel")}</Label><Input id="wa-app-secret" type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} placeholder={channel?.has_app_secret ? t("clients.whatsappCloud.secretSavedPlaceholder") : ""} disabled={busy} /></div>
        </div>
        {channel?.status === "connected" && <div className="space-y-4"><div className="font-mono text-sm"><Smartphone size={24} /><span><small>{t("clients.whatsapp.connectedNumber")}</small><strong>{channel.phone_number || channel.phone_number_id}</strong>{channel.display_name && <em>{channel.display_name}</em>}</span></div><div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} /> {t("clients.whatsapp.readyForMessages")}</div></div>}
        {channel?.last_error && <Alert>{channel.last_error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={saveOnly} disabled={!agentId || busy}>{t("clients.whatsappCloud.save")}</Button>
          <Button type="button" onClick={saveAndConnect} disabled={!canConnect}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Plug size={17} />} {t("clients.whatsappCloud.connectVerify")}</Button>
          {channel?.status === "connected" && <Button type="button" variant="destructive" onClick={disconnect} disabled={busy}><Power size={17} /> {t("clients.whatsappCloud.disconnect")}</Button>}
        </div>
      </Card>
      {channel && <Card className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><span><Webhook size={19} /></span><div><h2 className="font-heading">{t("clients.whatsappCloud.webhookTitle")}</h2><p>{t("clients.whatsappCloud.webhookCopy")}</p></div></div>
        <CopyField label={t("clients.whatsappCloud.webhookUrlLabel")} value={channel.webhook_url} />
        <CopyField label={t("clients.whatsappCloud.verifyTokenLabel")} value={channel.webhook_verify_token} />
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground"><li>{t("clients.whatsappCloud.webhookStep1")}</li><li>{t("clients.whatsappCloud.webhookStep2")}</li><li>{t("clients.whatsappCloud.webhookStep3")}</li></ol>
      </Card>}
    </main><aside className="space-y-4"><ShieldCheck size={22} /><h3 className="font-heading">{t("clients.whatsapp.separationTitle")}</h3><p>{t("clients.whatsapp.separationCopy")}<strong>{client.name}</strong>.</p><hr /><h3 className="font-heading">{t("clients.whatsapp.humanControlTitle")}</h3><p>{t("clients.whatsapp.humanControlCopy")}</p></aside></div>
  </div>;
}

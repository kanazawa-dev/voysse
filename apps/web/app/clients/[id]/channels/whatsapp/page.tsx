"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, LoaderCircle, MessageCircle, Plug, Power, QrCode, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api, ApiError, messageFrom } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import type { Client, WhatsAppChannel } from "@/types";
import { Card } from "@/components/ui/card";

const stateKeys: Record<WhatsAppChannel["status"], { label: I18nKey; copy: I18nKey }> = {
  disconnected: { label: "clients.whatsapp.statusDisconnectedLabel", copy: "clients.whatsapp.statusDisconnectedCopy" },
  connecting: { label: "clients.whatsapp.statusConnectingLabel", copy: "clients.whatsapp.statusConnectingCopy" },
  qr: { label: "clients.whatsapp.statusQrLabel", copy: "clients.whatsapp.statusQrCopy" },
  connected: { label: "clients.whatsapp.statusConnectedLabel", copy: "clients.whatsapp.statusConnectedCopy" },
  reconnecting: { label: "clients.whatsapp.statusReconnectingLabel", copy: "clients.whatsapp.statusReconnectingCopy" },
  error: { label: "clients.whatsapp.statusErrorLabel", copy: "clients.whatsapp.statusErrorCopy" },
};

export default function WhatsAppChannelPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [channel, setChannel] = useState<WhatsAppChannel | null>(null);
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadChannel = useCallback(async () => {
    try {
      const current = await api<WhatsAppChannel>(`/whatsapp/channels/${id}`);
      setChannel(current);
      setAgentId((value) => value || current.agent_id);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
      setChannel(null);
    }
  }, [id]);

  useEffect(() => {
    Promise.all([api<Client>(`/clients/${id}`).then((item) => { setClient(item); setAgentId((value) => value || item.agents[0]?.id || ""); }), loadChannel()])
      .catch((err) => setError(messageFrom(err))).finally(() => setLoading(false));
  }, [id, loadChannel]);

  useEffect(() => {
    if (!channel) return;
    const timer = window.setInterval(() => { loadChannel().catch((err) => setError(messageFrom(err))); }, 2500);
    return () => window.clearInterval(timer);
  }, [channel, loadChannel]);

  async function saveAndConnect() {
    if (!agentId) return;
    setBusy(true); setError("");
    try {
      await api<WhatsAppChannel>(`/whatsapp/channels/${id}`, { method: "PUT", body: JSON.stringify({ agent_id: agentId }) });
      setChannel(await api<WhatsAppChannel>(`/whatsapp/channels/${id}/connect`, { method: "POST" }));
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function saveAgent() {
    setBusy(true); setError("");
    try { setChannel(await api<WhatsAppChannel>(`/whatsapp/channels/${id}`, { method: "PUT", body: JSON.stringify({ agent_id: agentId }) })); }
    catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!confirm(t("clients.whatsapp.confirmDisconnect"))) return;
    setBusy(true); setError("");
    try { setChannel(await api<WhatsAppChannel>(`/whatsapp/channels/${id}/disconnect`, { method: "POST" })); }
    catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  if (loading || !client) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" /> {t("clients.whatsapp.loading")}</div>;
  const state = stateKeys[channel?.status || "disconnected"];
  const canConnect = Boolean(agentId && !busy && channel?.status !== "connected");
  return <div className="flex w-full flex-col gap-6">
    <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={17} /> {t("clients.whatsapp.back", { name: client.name })}</Link>
    <header className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center"><div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><MessageCircle size={26} /></div><div><span>{t("clients.whatsapp.channelOf", { name: client.name })}</span><h1 className="font-heading">{t("clients.whatsapp.title")}</h1><p>{t("clients.whatsapp.headerCopy")}</p></div>{channel && <div className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${channel.status === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : channel.status === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : channel.status === "qr" ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>{channel.status === "connected" ? <CheckCircle2 size={17} /> : channel.status === "error" ? <CircleAlert size={17} /> : <RefreshCw className={["connecting", "reconnecting"].includes(channel.status) ? "animate-spin" : ""} size={17} />} {t(state.label)}</div>}</header>
    {error && <Alert>{error}</Alert>}
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><main>
      <Card className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><span><Bot size={19} /></span><div><h2 className="font-heading">{t("clients.whatsapp.assignedAgent")}</h2><p>{t("clients.whatsapp.assignedAgentCopy")}</p></div></div><div className="flex items-center gap-3"><div className="grid min-w-64 gap-1.5"><Label>{t("clients.whatsapp.agentToRespond")}</Label><Select value={agentId || null} onValueChange={(value) => setAgentId(value ?? "")} disabled={busy}><SelectTrigger className="w-full"><SelectValue placeholder={t("clients.whatsapp.selectAgent")} /></SelectTrigger><SelectContent>{client.agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}{agent.is_active ? "" : t("clients.whatsapp.inactiveSuffix")}</SelectItem>)}</SelectContent></Select></div>{channel && channel.agent_id !== agentId && <Button type="button" variant="secondary" onClick={saveAgent} disabled={!agentId || busy}>{t("clients.whatsapp.saveAgent")}</Button>}</div>{!client.agents.length && <Alert>{t("clients.whatsapp.needsAgent")}</Alert>}</Card>
      <Card className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><span><Plug size={19} /></span><div><h2 className="font-heading">{t("clients.whatsapp.connection")}</h2><p>{t(state.copy)}</p></div></div>
        {channel?.status === "qr" && channel.qr_code && <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-xl border bg-white p-5 text-center text-slate-900 [&_img]:w-full"><img src={channel.qr_code} alt={t("clients.whatsapp.qrAlt")} /><div><span><QrCode size={18} /> {t("clients.whatsapp.scanFromPhone")}</span><ol><li>{t("clients.whatsapp.qrStep1")}</li><li>{t("clients.whatsapp.qrStep2Prefix")}<strong>{t("clients.whatsapp.qrStep2Bold")}</strong>.</li><li>{t("clients.whatsapp.qrStep3Prefix")}<strong>{t("clients.whatsapp.qrStep3Bold")}</strong>{t("clients.whatsapp.qrStep3Suffix")}</li></ol><small>{t("clients.whatsapp.qrHint")}</small></div></div>}
        {channel?.status === "connected" && <div className="space-y-4"><div className="font-mono text-sm"><Smartphone size={24} /><span><small>{t("clients.whatsapp.connectedNumber")}</small><strong>{channel.phone_number ? `+${channel.phone_number}` : t("clients.whatsapp.linkedNumber")}</strong>{channel.display_name && <em>{channel.display_name}</em>}</span></div><div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} /> {t("clients.whatsapp.readyForMessages")}</div></div>}
        {channel?.last_error && <Alert>{channel.last_error}</Alert>}
        <div className="flex flex-wrap gap-2">{channel?.status === "connected" ? <Button type="button" variant="destructive" onClick={disconnect} disabled={busy}><Power size={17} /> {t("clients.whatsapp.disconnectAccount")}</Button> : <Button type="button" onClick={saveAndConnect} disabled={!canConnect}>{busy || ["connecting", "reconnecting"].includes(channel?.status || "") ? <LoaderCircle className="animate-spin" size={17} /> : <QrCode size={17} />} {channel?.has_session ? t("clients.whatsapp.recoverConnection") : t("clients.whatsapp.connectWithQr")}</Button>}</div>
      </Card>
    </main><aside className="space-y-4"><ShieldCheck size={22} /><h3 className="font-heading">{t("clients.whatsapp.separationTitle")}</h3><p>{t("clients.whatsapp.separationCopy")}<strong>{client.name}</strong>.</p><hr /><h3 className="font-heading">{t("clients.whatsapp.humanControlTitle")}</h3><p>{t("clients.whatsapp.humanControlCopy")}</p></aside></div>
  </div>;
}

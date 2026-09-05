"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, FlaskConical, Globe, Inbox as InboxIcon, LoaderCircle, MessageCircle, Search, UserRound } from "lucide-react";
import { PageHead } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { api, messageFrom } from "@/lib/api";
import { formatWhen, isNearBottom, isSameOpenThread } from "@/lib/datetime";
import { useLanguage, useT } from "@/lib/i18n";
import type { Conversation, ConversationInbox } from "@/types";

const LIMIT = 30;
const POLL_MS = 8000;

export default function InboxPage() {
  const t = useT();
  const { lang } = useLanguage();
  const toast = useToast();
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<ConversationInbox[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [agentId, setAgentId] = useState("");
  const [channel, setChannel] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "human" | "ai">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ id: string; name: string }[]>("/conversations/inbox-agents").then(setAgents).catch(() => {}); }, []);
  useEffect(() => { const id = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(id); }, [searchInput]);

  const channelLabel = (value: string) => {
    if (value === "playground") return t("inbox.channelPlayground");
    if (value === "whatsapp") return t("inbox.channelWhatsapp");
    if (value === "whatsapp_cloud") return t("inbox.channelWhatsappCloud");
    if (value === "widget") return t("inbox.channelWidget");
    if (value === "instagram") return "Instagram";
    if (value === "messenger") return "Messenger";
    return value;
  };

  const channelIcon = (value: string) => {
    if (value === "whatsapp") return <MessageCircle size={10} />;
    if (value === "whatsapp_cloud") return <BadgeCheck size={10} />;
    if (value === "widget") return <Globe size={10} />;
    if (value === "playground") return <FlaskConical size={10} />;
    return <MessageCircle size={10} />;
  };

  const buildParams = useCallback((offsetValue: number) => {
    const params = new URLSearchParams();
    if (agentId) params.set("agent_id", agentId);
    if (channel) params.set("channel", channel);
    if (tab === "human" || tab === "ai") params.set("mode", tab);
    if (tab === "unread") params.set("unread", "1");
    if (search) params.set("search", search);
    params.set("limit", String(LIMIT));
    params.set("offset", String(offsetValue));
    return params.toString();
  }, [agentId, channel, tab, search]);

  const selectedIdRef = useRef<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    let cancelled = false;
    api<Conversation>(`/conversations/${id}`).then((conversation) => {
      if (!cancelled) { selectedIdRef.current = id; setSelected(conversation); }
    }).catch((err) => { if (!cancelled) toast.error(messageFrom(err)); });
    return () => { cancelled = true; };
  }, [toast]);
  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);
  const wasNearBottomRef = useRef(true);
  useEffect(() => {
    const el = messagesRef.current;
    if (el) { const handler = () => { wasNearBottomRef.current = isNearBottom(el); }; el.addEventListener("scroll", handler, { passive: true }); return () => el.removeEventListener("scroll", handler); }
  }, [selected?.id]);
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    if (wasNearBottomRef.current) {
      const frame = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      return () => cancelAnimationFrame(frame);
    }
  }, [selected?.id, selected?.messages?.at(-1)?.id]);

  const loadFirst = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const rows = await api<ConversationInbox[]>(`/conversations/inbox?${buildParams(0)}`);
      setItems(rows); setOffset(rows.length); setHasMore(rows.length === LIMIT);
    } catch (err) {
      if (!opts?.silent) toast.error(messageFrom(err));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [buildParams, toast]);

  const refreshSelected = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id) return;
    try {
      const conv = await api<Conversation>(`/conversations/${id}`);
      if (selectedIdRef.current !== id) return;
      setSelected((prev) => {
        if (isSameOpenThread(prev, conv)) return prev;
        setItems((rows) => rows.map((row) => (row.id === id ? { ...row, unread: false, unread_count: 0 } : row)));
        api(`/conversations/${id}/read`, { method: "POST" }).catch(() => {});
        return conv;
      });
    } catch {
      // Poll failures should not interrupt the open thread.
    }
  }, []);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  // Live refresh of the first page and the open thread (skipped once the user scrolls into older pages).
  useEffect(() => {
    const id = setInterval(() => {
      if (offset <= LIMIT) {
        loadFirst({ silent: true });
        refreshSelected();
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [loadFirst, refreshSelected, offset]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await api<ConversationInbox[]>(`/conversations/inbox?${buildParams(offset)}`);
      setItems((prev) => [...prev, ...rows]); setOffset((o) => o + rows.length); setHasMore(rows.length === LIMIT);
    } catch (err) { toast.error(messageFrom(err)); } finally { setLoadingMore(false); }
  }

  function onScroll(event: React.UIEvent<HTMLElement>) {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) loadMore();
  }

  async function choose(id: string) {
    selectedIdRef.current = id;
    setSelected(await api<Conversation>(`/conversations/${id}`));
    setItems((rows) => rows.map((row) => (row.id === id ? { ...row, unread: false, unread_count: 0 } : row)));
    api(`/conversations/${id}/read`, { method: "POST" }).catch(() => {});
  }

  async function toggleMode(next: "ai" | "human") {
    if (!selected) return;
    setSelected(await api<Conversation>(`/conversations/${selected.id}/mode`, { method: "PATCH", body: JSON.stringify({ mode: next }) }));
    loadFirst({ silent: true });
  }

  const composerRef = useRef<HTMLInputElement>(null);
  const pendingReply = useRef<{ id: string; conversation: string; content: string } | null>(null);
  const [unresolved, setUnresolved] = useState(false);
  const submitting = useRef(false);
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submitting.current) return;
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") || "").trim();
    if (!content) return;
    if (pendingReply.current && (pendingReply.current.conversation !== selected.id || pendingReply.current.content !== content)) {
      toast.error(lang === "es" ? "Comprueba primero el intento anterior; no cambies el mensaje mientras su resultado sea desconocido." : "Check the previous attempt first; do not change a message while its result is unknown.");
      return;
    }
    const pending = pendingReply.current ?? { id: crypto.randomUUID(), conversation: selected.id, content };
    pendingReply.current = pending;
    submitting.current = true;
    setBusy(true);
    try {
      const result = await api<Conversation>(`/conversations/${pending.conversation}/reply`, { method: "POST", body: JSON.stringify({ content: pending.content, request_id: pending.id }) });
      if (selectedIdRef.current === result.id) setSelected(result);
      const outcome = result.deliveries?.find((attempt) => attempt.id === pending.id);
      if (!outcome) throw new Error(lang === "es" ? "No se pudo verificar el intento. Conserva el texto y consulta de nuevo." : "Could not verify the attempt. Keep the text and check again.");
      pendingReply.current = null;
      setUnresolved(false);
      form.reset();
      if (outcome.status === "uncertain" || outcome.status === "sending") toast.info(lang === "es" ? "El envío aún no está confirmado. Revisa su estado antes de repetirlo." : "Delivery is not confirmed. Check its status before sending again.");
      if (outcome.status === "failed") toast.error(lang === "es" ? "No se envió: revisa el motivo en la conversación." : "Not sent: check the reason in the conversation.");
      loadFirst({ silent: true });
    } catch {
      setUnresolved(true);
      toast.error(lang === "es" ? "No recibimos confirmación. Pulsa Consultar intento para repetir la consulta con el mismo identificador, sin duplicar el envío." : "No confirmation received. Click Check attempt to repeat the request with the same identifier without duplicating the send.");
    } finally {
      submitting.current = false;
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  const deliveryReason = (code: string | null) => {
    const reasons: Record<string, [string, string]> = {
      conversation_busy: ["La conversación estaba ocupada. Este intento no se envió.", "The conversation was busy. This attempt was not sent."],
      empty_message: ["El mensaje está vacío.", "The message is empty."],
      human_control_required: ["Toma el control humano antes de enviar.", "Take human control before sending."],
      destination_inactive: ["El cliente o la agencia están desactivados.", "The client or agency is inactive."],
      destination_unavailable: ["Revisa la conexión y el destino del canal.", "Check the channel connection and destination."],
      channel_or_window_unavailable: ["Revisa la conexión y la ventana de respuesta del canal.", "Check the connection and reply window."],
      reply_window_closed: ["La ventana de respuesta terminó. Espera un nuevo mensaje del cliente.", "The reply window closed. Wait for a new customer message."],
      message_too_long: ["El texto excede el límite del canal; no se recortó ni envió.", "The text exceeds the channel limit; it was not truncated or sent."],
      unsupported_channel: ["Este canal no admite envío desde aquí.", "This channel does not support sending here."],
      confirmation_missing: ["Puede haber llegado. Comprueba el canal antes de volver a enviar; no se reintentará automáticamente.", "It may have arrived. Check the channel before sending again; there is no automatic retry."],
    };
    return code ? (reasons[code]?.[lang === "es" ? 0 : 1] ?? code) : "";
  };

  return <div className="flex w-full flex-col gap-6">
    <PageHead eyebrow={t("inbox.eyebrow")} title={t("inbox.title")} description={t("inbox.description")} />

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <Select value={agentId || "__all__"} onValueChange={(value) => setAgentId(!value || value === "__all__" ? "" : value)}><SelectTrigger className="w-full sm:w-56"><SelectValue>{agents.find((agent) => agent.id === agentId)?.name || t("inbox.allAgents")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__all__">{t("inbox.allAgents")}</SelectItem>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select>
      <Select value={channel || "__all__"} onValueChange={(value) => setChannel(!value || value === "__all__" ? "" : value)}><SelectTrigger className="w-full sm:w-56"><SelectValue>{channel ? ({ playground: t("inbox.channelPlayground"), whatsapp: t("inbox.channelWhatsapp"), whatsapp_cloud: t("inbox.channelWhatsappCloud"), widget: t("inbox.channelWidget") }[channel] || channel) : t("inbox.allChannels")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__all__">{t("inbox.allChannels")}</SelectItem><SelectItem value="playground">{t("inbox.channelPlayground")}</SelectItem><SelectItem value="whatsapp">{t("inbox.channelWhatsapp")}</SelectItem><SelectItem value="whatsapp_cloud">{t("inbox.channelWhatsappCloud")}</SelectItem><SelectItem value="widget">{t("inbox.channelWidget")}</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="messenger">Messenger</SelectItem></SelectContent></Select>
    </div>

    <div className="grid min-h-[calc(100vh-7rem)] overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[22rem_1fr]">
      <aside className="divide-y" onScroll={onScroll}>
        <div className="relative border-b p-3"><Search size={16} /><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t("inbox.searchPlaceholder")} /></div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="border-b p-2"><TabsList variant="line" className="w-full"><TabsTrigger value="all">{t("inbox.tabAll")}</TabsTrigger><TabsTrigger value="unread">{t("inbox.tabUnread")}</TabsTrigger><TabsTrigger value="human">{t("inbox.statusHuman")}</TabsTrigger><TabsTrigger value="ai">{t("inbox.statusAi")}</TabsTrigger></TabsList></Tabs>
        {loading ? <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground"><LoaderCircle className="animate-spin" size={16} /> {t("inbox.loading")}</div>
          : items.length ? <>
            {items.map((item) => (
              <Button type="button" variant="ghost" key={item.id} className={`h-auto w-full justify-start rounded-none p-3 text-left ${selected?.id === item.id ? "bg-muted ring-1 ring-inset ring-border" : ""} ${item.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`} disabled={unresolved || busy} onClick={() => choose(item.id)}>
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound size={15} /></span>
                  <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background text-primary ring-1 ring-border" title={channelLabel(item.channel)}>{channelIcon(item.channel)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center justify-between gap-2"><strong className="truncate">{item.contact_name || item.title}</strong><time className="shrink-0 text-[10px]">{formatWhen(item.updated_at, lang)}</time></span>
                  <small className="block truncate text-sm text-muted-foreground">{item.preview || t("inbox.noMessages")}</small>
                  <small className="block truncate text-xs text-muted-foreground">{item.agent_name} · {channelLabel(item.channel)} <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.mode === "human" ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/10 text-primary"}`}>{item.mode === "human" ? t("inbox.modeHuman") : t("inbox.modeAi")}</span></small>
                </span>
                {item.unread_count > 0 && selected?.id !== item.id && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={t("inbox.unreadCount", { count: item.unread_count })}>{item.unread_count > 99 ? "99+" : item.unread_count}</span>}
              </Button>
            ))}
            {loadingMore && <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground"><LoaderCircle className="animate-spin" size={15} /></div>}
          </> : <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">{t("inbox.empty")}</div>}
      </aside>

      <section className="flex min-h-0 flex-col">
        {!selected ? <div className="flex min-h-64 flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:mt-1 [&_p]:max-w-md [&_p]:text-sm [&_p]:text-muted-foreground"><div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><InboxIcon /></div><h3 className="font-heading">{t("inbox.empty")}</h3><p>{t("inbox.selectPrompt")}</p></div>
          : <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div className="min-w-0 [&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground"><strong>{selected.contact_name || selected.title}</strong><small>{channelLabel(selected.channel)}</small></div>
              <Button type="button" variant="outline" className={selected.mode === "human" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-primary/20 bg-primary/10 text-primary"} disabled={busy || unresolved} onClick={() => toggleMode(selected.mode === "ai" ? "human" : "ai")}>{selected.mode === "ai" ? t("inbox.takeControl") : t("inbox.returnToAi")}</Button>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4" ref={messagesRef}>
              {selected.messages?.map((message) => (
                <div key={message.id} className={`flex max-w-[90%] flex-col gap-2 rounded-xl bg-background p-3 shadow-sm ${message.role === "assistant" ? "mr-auto" : "ml-auto bg-primary text-primary-foreground"}`}>
                  <small>{message.sender_name || (message.role === "assistant" ? t("inbox.senderAgent") : t("inbox.senderVisitor"))} · {formatWhen(message.created_at, lang)}</small>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              ))}
              {selected.deliveries?.filter((attempt) => !["confirmed", "published"].includes(attempt.status)).map((attempt) => (
                <div key={attempt.id} className="space-y-2 rounded-2xl border border-amber-300/60 bg-amber-50/60 p-3 text-sm text-foreground" role="status">
                  <strong>{attempt.status === "failed" ? (lang === "es" ? "No enviado" : "Not sent") : attempt.status === "uncertain" ? (lang === "es" ? "Envío incierto" : "Uncertain send") : (lang === "es" ? "Esperando confirmación" : "Awaiting confirmation")}</strong>
                  <p className="whitespace-pre-wrap break-words">{attempt.content}</p>
                  <p>{deliveryReason(attempt.error_code)}</p>
                  <small className="block break-all">{attempt.sender_name} · {formatWhen(attempt.created_at, lang)} · {attempt.id}</small>
                </div>
              ))}
            </div>
            <form className="border-t p-3" onSubmit={reply}>
              {unresolved && <p role="alert" className="mb-2 text-sm">{lang === "es" ? "Resultado desconocido. Conservamos este intento para consultarlo sin duplicarlo." : "Unknown result. This attempt is retained so you can check it without duplicating it."}</p>}
              <Input ref={composerRef} name="content" placeholder={selected.mode === "human" ? t("inbox.composerHuman") : t("inbox.composerLocked")} readOnly={unresolved || busy} maxLength={["instagram", "messenger"].includes(selected.channel) ? 1000 : selected.channel === "whatsapp_cloud" ? 4096 : 50000} disabled={selected.mode !== "human" && !unresolved} required />
              <Button type="submit" disabled={(selected.mode !== "human" && !unresolved) || busy}>{unresolved ? (lang === "es" ? "Consultar intento" : "Check attempt") : t("inbox.send")}</Button>
            </form>
          </>}
      </section>
    </div>
  </div>;
}

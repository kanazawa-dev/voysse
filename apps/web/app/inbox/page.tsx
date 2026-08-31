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
import type { Agent, Conversation, ConversationInbox } from "@/types";

const LIMIT = 30;
const POLL_MS = 8000;

export default function InboxPage() {
  const t = useT();
  const { lang } = useLanguage();
  const toast = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
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

  useEffect(() => { api<Agent[]>("/agents").then(setAgents).catch(() => {}); }, []);
  useEffect(() => { const id = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(id); }, [searchInput]);

  const channelLabel = (value: string) => {
    if (value === "playground") return t("inbox.channelPlayground");
    if (value === "whatsapp") return t("inbox.channelWhatsapp");
    if (value === "whatsapp_cloud") return t("inbox.channelWhatsappCloud");
    if (value === "widget") return t("inbox.channelWidget");
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
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      setSelected(await api<Conversation>(`/conversations/${selected.id}/reply`, { method: "POST", body: JSON.stringify({ content: data.get("content") }) }));
      form.reset();
      loadFirst({ silent: true });
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); composerRef.current?.focus(); }
  }

  return <div className="flex w-full flex-col gap-6">
    <PageHead eyebrow={t("inbox.eyebrow")} title={t("inbox.title")} description={t("inbox.description")} />

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <Select value={agentId || "__all__"} onValueChange={(value) => setAgentId(!value || value === "__all__" ? "" : value)}><SelectTrigger className="w-full sm:w-56"><SelectValue>{agents.find((agent) => agent.id === agentId)?.name || t("inbox.allAgents")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__all__">{t("inbox.allAgents")}</SelectItem>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select>
      <Select value={channel || "__all__"} onValueChange={(value) => setChannel(!value || value === "__all__" ? "" : value)}><SelectTrigger className="w-full sm:w-56"><SelectValue>{channel ? ({ playground: t("inbox.channelPlayground"), whatsapp: t("inbox.channelWhatsapp"), whatsapp_cloud: t("inbox.channelWhatsappCloud"), widget: t("inbox.channelWidget") }[channel] || channel) : t("inbox.allChannels")}</SelectValue></SelectTrigger><SelectContent><SelectItem value="__all__">{t("inbox.allChannels")}</SelectItem><SelectItem value="playground">{t("inbox.channelPlayground")}</SelectItem><SelectItem value="whatsapp">{t("inbox.channelWhatsapp")}</SelectItem><SelectItem value="whatsapp_cloud">{t("inbox.channelWhatsappCloud")}</SelectItem><SelectItem value="widget">{t("inbox.channelWidget")}</SelectItem></SelectContent></Select>
    </div>

    <div className="grid min-h-[calc(100vh-7rem)] overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[22rem_1fr]">
      <aside className="divide-y" onScroll={onScroll}>
        <div className="relative border-b p-3"><Search size={16} /><Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t("inbox.searchPlaceholder")} /></div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="border-b p-2"><TabsList variant="line" className="w-full"><TabsTrigger value="all">{t("inbox.tabAll")}</TabsTrigger><TabsTrigger value="unread">{t("inbox.tabUnread")}</TabsTrigger><TabsTrigger value="human">{t("inbox.statusHuman")}</TabsTrigger><TabsTrigger value="ai">{t("inbox.statusAi")}</TabsTrigger></TabsList></Tabs>
        {loading ? <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground"><LoaderCircle className="animate-spin" size={16} /> {t("inbox.loading")}</div>
          : items.length ? <>
            {items.map((item) => (
              <Button type="button" variant="ghost" key={item.id} className={`h-auto w-full justify-start rounded-none p-3 text-left ${selected?.id === item.id ? "bg-muted ring-1 ring-inset ring-border" : ""} ${item.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`} onClick={() => choose(item.id)}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRound size={15} /></span>
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground" title={channelLabel(item.channel)}>{channelIcon(item.channel)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><strong>{item.contact_name || item.title}</strong><time>{formatWhen(item.updated_at, lang)}</time></span>
                  <small className="truncate text-sm text-muted-foreground">{item.preview || t("inbox.noMessages")}</small>
                  <small className="ml-auto text-xs text-muted-foreground">{item.agent_name} · {channelLabel(item.channel)} <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.mode === "human" ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/10 text-primary"}`}>{item.mode === "human" ? t("inbox.modeHuman") : t("inbox.modeAi")}</span></small>
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
            <header>
              <div><strong>{selected.contact_name || selected.title}</strong><small>{channelLabel(selected.channel)}</small></div>
              <Button type="button" variant="outline" className={selected.mode === "human" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-primary/20 bg-primary/10 text-primary"} onClick={() => toggleMode(selected.mode === "ai" ? "human" : "ai")}>{selected.mode === "ai" ? t("inbox.takeControl") : t("inbox.returnToAi")}</Button>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4" ref={messagesRef}>
              {selected.messages?.map((message) => (
                <div key={message.id} className={`flex max-w-[80%] gap-2 rounded-xl bg-background p-3 shadow-sm ${message.role === "assistant" ? "mr-auto" : "ml-auto bg-primary text-primary-foreground"}`}>
                  <small>{message.sender_name || (message.role === "assistant" ? t("inbox.senderAgent") : t("inbox.senderVisitor"))} · {formatWhen(message.created_at, lang)}</small>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
            <form className="border-t p-3" onSubmit={reply}>
              <Input ref={composerRef} name="content" placeholder={selected.mode === "human" ? t("inbox.composerHuman") : t("inbox.composerLocked")} disabled={selected.mode !== "human"} required />
              <Button type="submit" disabled={selected.mode !== "human" || busy}>{t("inbox.send")}</Button>
            </form>
          </>}
      </section>
    </div>
  </div>;
}

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, FileText, ImageIcon, LoaderCircle, MessageSquarePlus, Send, Sparkles, TriangleAlert, UserRound, Wrench } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { Alert, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n";
import type { Agent, Client, Conversation } from "@/types";

export function ChatPlayground({ lockedAgentId }: { lockedAgentId?: string }) {
  const t = useT();
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clientId, setClientId] = useState("");
  const [agentId, setAgentId] = useState(lockedAgentId || "");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api<Client[]>("/clients"), api<Agent[]>("/agents")]).then(([c, a]) => {
      setClients(c); setAgents(a);
      const initial = lockedAgentId ? a.find((item) => item.id === lockedAgentId) : a[0];
      if (initial) { setAgentId(initial.id); setClientId(initial.client_id); }
      else if (c[0]) setClientId(c[0].id);
    });
  }, [lockedAgentId]);

  useEffect(() => {
    if (!agentId) { setConversations([]); setConversation(null); return; }
    api<Conversation[]>(`/conversations?agent_id=${agentId}`).then((items) => {
      setConversations(items);
      if (items[0]) api<Conversation>(`/conversations/${items[0].id}`).then(setConversation);
      else setConversation(null);
    });
  }, [agentId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation?.messages?.length]);

  const availableAgents = useMemo(() => agents.filter((agent) => agent.client_id === clientId), [agents, clientId]);
  const selectedAgent = agents.find((agent) => agent.id === agentId);

  async function newConversation() {
    if (!agentId) return;
    const created = await api<Conversation>("/conversations", { method: "POST", body: JSON.stringify({ agent_id: agentId }) });
    setConversation(created); setConversations((items) => [created, ...items]);
  }
  async function chooseConversation(item: Conversation) {
    setConversation(await api<Conversation>(`/conversations/${item.id}`));
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("message") as HTMLTextAreaElement;
    const content = input.value.trim();
    if (!content || busy || !agentId) return;
    setBusy(true); input.value = "";
    try {
      let current = conversation;
      if (!current) {
        current = await api<Conversation>("/conversations", { method: "POST", body: JSON.stringify({ agent_id: agentId }) });
      }
      const optimistic = { ...current, messages: [...(current.messages || []), { id: "temp", role: "user" as const, content, sources: [], sender_type: "visitor" as const, sender_name: t("playground.message.you"), created_at: new Date().toISOString() }] };
      setConversation(optimistic);
      const updated = await api<Conversation>(`/conversations/${current.id}/messages`, { method: "POST", body: JSON.stringify({ content }) });
      setConversation(updated);
      setConversations(await api<Conversation[]>(`/conversations?agent_id=${agentId}`));
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); composerRef.current?.focus(); }
  }
  async function sendImage(file?: File) {
    if (!file || busy || !agentId) return;
    setBusy(true);
    const caption = (composerRef.current?.value || "").trim();
    try {
      let current = conversation;
      if (!current) {
        current = await api<Conversation>("/conversations", { method: "POST", body: JSON.stringify({ agent_id: agentId }) });
      }
      const data = new FormData();
      data.append("file", file);
      if (caption) data.append("caption", caption);
      const updated = await api<Conversation>(`/conversations/${current.id}/media`, { method: "POST", body: data });
      if (composerRef.current) composerRef.current.value = "";
      setConversation(updated);
      setConversations(await api<Conversation[]>(`/conversations?agent_id=${agentId}`));
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); if (imageRef.current) imageRef.current.value = ""; }
  }

  return <div className={`grid min-h-[calc(100vh-11rem)] overflow-hidden rounded-xl border bg-card lg:grid-cols-[18rem_1fr] ${lockedAgentId ? "mt-1 h-[650px]" : ""}`}>
    <aside className="flex min-h-0 flex-col border-r">
      {!lockedAgentId && <div className="grid gap-3 border-b p-4"><div className="grid gap-1.5"><Label>{t("playground.selectors.client")}</Label><Select value={clientId || null} onValueChange={(value) => { const next = value ?? ""; setClientId(next); const first = agents.find((a) => a.client_id === next); setAgentId(first?.id || ""); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>{t("playground.selectors.agent")}</Label><Select value={agentId || null} onValueChange={(value) => setAgentId(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder={t("playground.selectors.agentPlaceholder")} /></SelectTrigger><SelectContent>{availableAgents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select></div></div>}
      <div className="flex items-center justify-between border-b p-4"><strong>{t("playground.conversations.heading")}</strong><Button type="button" size="icon" variant="ghost" onClick={newConversation} disabled={!agentId} title={t("playground.conversations.new")}><MessageSquarePlus size={17} /></Button></div>
      <ScrollArea className="min-h-0 flex-1">{conversations.map((item) => <Button type="button" variant="ghost" key={item.id} className={`h-auto w-full justify-start rounded-none px-3 py-2 text-left ${conversation?.id === item.id ? "bg-muted font-medium" : ""}`} onClick={() => chooseConversation(item)}><MessageSquarePlus size={15} /><span className="min-w-0"><strong className="block truncate">{item.title}</strong><small className="block text-muted-foreground">{new Date(item.updated_at).toLocaleDateString("es", { day: "numeric", month: "short" })}</small></span></Button>)}{agentId && !conversations.length && <small className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">{t("playground.conversations.empty")}</small>}</ScrollArea>
    </aside>
    <section className="flex min-h-0 flex-col">
      <header className="flex items-center justify-between border-b p-4">{selectedAgent ? <><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot size={18} /></span><div><strong>{selectedAgent.name}</strong><small><i className={`mr-1 inline-block size-1.5 rounded-full ${selectedAgent.model ? "bg-emerald-500" : "bg-muted-foreground"}`} />{selectedAgent.model ? t("playground.chat.modelConfigured") : t("playground.chat.noModelConfigured")}</small></div></> : <div><strong>{t("playground.chat.fallbackTitle")}</strong><small>{t("playground.chat.fallbackSubtitle")}</small></div>}{conversation && <span className={`rounded-full px-2 py-1 text-xs font-medium ${conversation.mode === "human" ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/10 text-primary"}`}>{conversation.mode === "human" ? t("playground.chat.modeHuman") : t("playground.chat.modeAi")}</span>}</header>
      <ScrollArea className="min-h-0 flex-1 bg-muted/20"><div className="space-y-4 p-4">
        {!agentId ? <EmptyState icon={<Bot />} title={t("playground.empty.title")} description={t("playground.empty.description")} /> : !conversation?.messages?.length ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground"><span><Sparkles size={24} /></span><h3 className="font-heading">{t("playground.welcome.title", { name: selectedAgent?.name || "" })}</h3><p>{t("playground.welcome.description")}</p>{!selectedAgent?.model && <Alert type="info">{t("playground.welcome.noModelAlert")}</Alert>}</div> : conversation.messages.map((message) => <div className={`flex gap-3 ${message.role === "assistant" ? "" : "flex-row-reverse"}`} key={message.id}><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{message.role === "assistant" ? <Bot size={17} /> : <UserRound size={17} />}</span><div className="max-w-[85%]"><small>{message.sender_name || (message.role === "assistant" ? selectedAgent?.name : t("playground.message.you"))}</small><div className="rounded-xl bg-background p-3 text-sm shadow-sm">{message.content}</div>{message.sources?.length > 0 && <div className="mt-2 space-y-1 text-xs text-muted-foreground"><strong><FileText size={13} /> {t("playground.message.sourcesUsed")}</strong>{message.sources.map((source) => <span key={source.id} title={source.excerpt}>{source.filename}</span>)}</div>}{(message.tool_calls?.length ?? 0) > 0 && <div className="mt-2 space-y-1 text-xs text-muted-foreground"><strong><Wrench size={13} /> {t("tools.usedInReply")}</strong>{message.tool_calls!.map((call, index) => <span key={index} className={call.is_error ? "text-destructive" : ""} title={call.result_preview}>{call.name}</span>)}</div>}{message.tool_calls?.some((call) => call.is_error) && <div className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{message.tool_calls!.filter((call) => call.is_error).map((call, index) => <small key={index}><TriangleAlert size={12} /> <strong>{call.name}</strong> {call.result_preview}</small>)}</div>}</div></div>)}
        {busy && <div className="flex gap-3 "><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot size={17} /></span><div className="animate-pulse text-muted-foreground"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div></ScrollArea>
      <div className="border-t bg-background p-3"><form className="flex items-end gap-2" onSubmit={send}>{selectedAgent?.image_enabled && <><Button type="button" size="icon" variant="ghost" disabled={!agentId || busy} title={t("playground.composer.attachImage")} aria-label={t("playground.composer.attachImage")} onClick={() => imageRef.current?.click()}><ImageIcon size={18} /></Button><input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => sendImage(e.target.files?.[0])} /></>}<Textarea className="min-h-10 flex-1 resize-none" ref={composerRef} name="message" rows={1} placeholder={agentId ? t("playground.composer.placeholder") : t("playground.composer.placeholderNoAgent")} disabled={!agentId} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><Button type="submit" size="icon" disabled={!agentId || busy} aria-label={t("playground.composer.send")}>{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}</Button></form><small className="mt-2 block text-center text-xs text-muted-foreground">{t("playground.composer.disclaimer")}</small></div>
    </section>
  </div>;
}

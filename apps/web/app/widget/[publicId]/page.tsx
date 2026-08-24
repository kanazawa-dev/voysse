"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { LoaderCircle, Send, X } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";

type Config = { title: string; greeting: string; color: string; position: string; agency_name: string; agency_logo_url: string | null };
type Msg = { role: "user" | "assistant"; content: string };
type Reply = { mode: string; reply: string | null; messages: Msg[] };

export default function WidgetPage() {
  const t = useT();
  const { publicId } = useParams<{ publicId: string }>();
  const [config, setConfig] = useState<Config | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [session, setSession] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = `ol_widget_${publicId}`;
    let value = "";
    try { value = window.localStorage.getItem(key) || ""; } catch {}
    if (!value) { value = crypto.randomUUID(); try { window.localStorage.setItem(key, value); } catch {} }
    setSession(value);
  }, [publicId]);

  useEffect(() => {
    api<Config>(`/widget/${publicId}`).then(setConfig).catch(() => setError("unavailable"));
  }, [publicId]);

  useEffect(() => {
    if (!session) return;
    api<Reply>(`/widget/${publicId}/history?session_id=${encodeURIComponent(session)}`).then((data) => setMessages(data.messages)).catch(() => {});
  }, [session, publicId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  function close() { window.parent?.postMessage({ type: "ol-widget", action: "close" }, "*"); }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = inputRef.current;
    const content = input?.value.trim() || "";
    if (!content || busy || !session) return;
    if (input) input.value = "";
    setBusy(true); setError("");
    setMessages((current) => [...current, { role: "user", content }]);
    try {
      const data = await api<Reply>(`/widget/${publicId}/messages`, { method: "POST", body: JSON.stringify({ session_id: session, content }) });
      if (data.reply) setMessages((current) => [...current, { role: "assistant", content: data.reply as string }]);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); inputRef.current?.focus(); }
  }

  if (error === "unavailable") return <div className="widget-shell"><div className="widget-empty">Chat unavailable</div></div>;
  if (!config) return <div className="widget-shell"><div className="widget-empty"><LoaderCircle className="spin" /></div></div>;

  const color = config.color || "#635bff";
  const showGreeting = config.greeting && messages.length === 0;
  return (
    <div className="widget-shell" style={{ ["--widget-color" as string]: color }}>
      <header className="widget-head">
        <div className="widget-head-id">
          {config.agency_logo_url ? <img src={config.agency_logo_url} alt="" /> : <span className="widget-avatar">{config.title.slice(0, 1).toUpperCase()}</span>}
          <div><strong>{config.title}</strong><small>{config.agency_name}</small></div>
        </div>
        <button type="button" className="widget-close" onClick={close} aria-label="Close"><X size={18} /></button>
      </header>
      <div className="widget-messages">
        {showGreeting && <div className="widget-msg assistant"><div className="widget-bubble">{config.greeting}</div></div>}
        {messages.map((message, index) => <div key={index} className={`widget-msg ${message.role}`}><div className="widget-bubble">{message.content}</div></div>)}
        {busy && <div className="widget-msg assistant"><div className="widget-bubble widget-typing"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>
      {error && error !== "unavailable" && <div className="widget-error">{error}</div>}
      <form className="widget-composer" onSubmit={send}>
        <input ref={inputRef} name="message" autoComplete="off" placeholder={t("playground.composer.placeholder")} />
        <button type="submit" disabled={busy} aria-label={t("playground.composer.send")}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button>
      </form>
    </div>
  );
}

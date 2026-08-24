"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, Save, Server, Wifi } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentTool } from "@/types";
import { HeadersEditor, headersToDict, type HeaderRow } from "./headers-editor";

type McpTestResult = { ok: boolean; tools: { name: string; description: string }[] };

export function McpServerModal({ agentId, tool, open, onClose, onSaved }: {
  agentId: string;
  tool: AgentTool | null;
  open: boolean;
  onClose: () => void;
  onSaved: (tool: AgentTool) => void;
}) {
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<"sse" | "streamable_http">("streamable_http");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [headersTouched, setHeadersTouched] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [tested, setTested] = useState<McpTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(tool?.name || ""); setDescription(tool?.description || "");
    setUrl(tool?.url || ""); setTransport(tool?.transport || "streamable_http");
    setHeaderRows([]); setHeadersTouched(false); setShowHeaders(!tool?.has_headers);
    setTested(null); setTesting(false);
  }, [open, tool]);

  // Connection settings changed: the previous test no longer proves anything.
  const invalidateTest = () => setTested(null);
  // Editing without touching connection settings keeps the stored (verified) config.
  const connectionUnchanged = !!tool && url === tool.url && transport === tool.transport && !headersTouched;
  const canSave = connectionUnchanged || !!tested;

  async function testConnection() {
    setTesting(true);
    try {
      const result = await api<McpTestResult>(`/agents/${agentId}/tools/test-mcp`, {
        method: "POST",
        body: JSON.stringify({
          url, transport,
          headers: headersTouched ? headersToDict(headerRows) : undefined,
          tool_id: tool && !headersTouched ? tool.id : undefined,
        }),
      });
      setTested(result);
      toast.success(t("tools.mcp.testSuccess", { count: result.tools.length }));
    } catch (err) { setTested(null); toast.error(messageFrom(err)); } finally { setTesting(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    const payload: Record<string, unknown> = { name, description, url, transport };
    if (headersTouched) payload.headers = headersToDict(headerRows);
    try {
      const saved = tool
        ? await api<AgentTool>(`/agents/${agentId}/tools/${tool.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<AgentTool>(`/agents/${agentId}/tools`, { method: "POST", body: JSON.stringify({ type: "mcp", ...payload }) });
      onSaved(saved);
      onClose();
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} title={tool ? t("tools.mcp.editTitle") : t("tools.mcp.createTitle")} description={t("tools.mcp.subtitle")} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label>{t("tools.form.name")}
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="weather_service" pattern="[a-z][a-z0-9]*(_[a-z0-9]+)*" maxLength={24} />
          <span className="mt-1.5 text-xs text-muted-foreground">{t("tools.form.nameHint")}</span>
        </label>
        <label>{t("tools.form.description")}
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("tools.form.descriptionPlaceholder")} />
        </label>
        <label>{t("tools.mcp.serverUrl")}
          <Input required type="url" value={url} onChange={(e) => { setUrl(e.target.value); invalidateTest(); }} placeholder="https://mcp-server.example.com/mcp" />
        </label>
        <span className="mb-1.5 block text-sm font-medium">{t("tools.mcp.transport")}</span>
        <Tabs value={transport} onValueChange={(value) => { setTransport(value as typeof transport); invalidateTest(); }}><TabsList className="w-full"><TabsTrigger value="sse">{t("tools.mcp.sse")}</TabsTrigger><TabsTrigger value="streamable_http">{t("tools.mcp.streamableHttp")}</TabsTrigger></TabsList></Tabs>
        <span className="mb-1.5 block text-sm font-medium">{t("tools.form.headers")}</span>
        {tool?.has_headers && !showHeaders
          ? <div className="space-y-2"><small>{t("tools.form.headersConfigured")}</small><Button type="button" variant="ghost" onClick={() => { setShowHeaders(true); setHeadersTouched(true); invalidateTest(); }}>{t("tools.form.replaceHeaders")}</Button></div>
          : <HeadersEditor rows={headerRows} onChange={(rows) => { setHeaderRows(rows); setHeadersTouched(true); invalidateTest(); }} />}
        {tested
          ? <div className="rounded-lg border bg-muted/30 p-4"><strong>{t("tools.mcp.discoveredTools")}</strong><div className="mt-2 space-y-1 text-xs text-muted-foreground">{tested.tools.map((item) => <span key={item.name} title={item.description}><Server size={12} /> {item.name}</span>)}</div></div>
          : <Alert type="info">{t("tools.mcp.testNote")}</Alert>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={testConnection} disabled={testing || !url}>
            {testing ? <LoaderCircle className="animate-spin" size={16} /> : <Wifi size={16} />} {testing ? t("tools.mcp.testing") : t("tools.mcp.testConnection")}
          </Button>
          <span className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose}>{t("tools.form.cancel")}</Button>
          <Button type="submit" disabled={busy || !canSave}>
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
            {busy ? t("tools.form.saving") : tool ? t("tools.mcp.save") : t("tools.mcp.addServer")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

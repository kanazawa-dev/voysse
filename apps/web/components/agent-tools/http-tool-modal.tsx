"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, Plus, Save, Trash2, Zap } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgentTool, ToolParam } from "@/types";
import { HeadersEditor, headersToDict, type HeaderRow } from "./headers-editor";

const EMPTY_PARAM: ToolParam = { name: "", type: "string", description: "", required: false };

function ParamsEditor({ label, params, onChange }: { label: string; params: ToolParam[]; onChange: (params: ToolParam[]) => void }) {
  const t = useT();
  const update = (index: number, patch: Partial<ToolParam>) =>
    onChange(params.map((param, i) => (i === index ? { ...param, ...patch } : param)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <strong>{label}</strong>
        <Button type="button" variant="outline" onClick={() => onChange([...params, { ...EMPTY_PARAM }])}>
          <Plus size={14} /> {t("tools.http.addParam")}
        </Button>
      </div>
      {params.map((param, index) => (
        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2" key={index}>
          <Input placeholder={t("tools.http.paramName")} value={param.name} onChange={(e) => update(index, { name: e.target.value })} />
          <Select value={param.type} onValueChange={(value) => value && update(index, { type: value as ToolParam["type"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["string", "number", "integer", "boolean"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
          <Input placeholder={t("tools.http.paramDescription")} value={param.description} onChange={(e) => update(index, { description: e.target.value })} />
          <label className="text-xs text-destructive" title={t("tools.http.paramRequired")}>
            <Switch checked={param.required} onCheckedChange={(checked) => update(index, { required: checked })} />
            {t("tools.http.paramRequired")}
          </label>
          <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => onChange(params.filter((_, i) => i !== index))} title={t("tools.delete")}>
            <Trash2 size={15} />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function HttpToolModal({ agentId, tool, open, onClose, onSaved }: {
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
  const [method, setMethod] = useState("GET");
  const [promptInstructions, setPromptInstructions] = useState("");
  const [queryParams, setQueryParams] = useState<ToolParam[]>([]);
  const [bodyParams, setBodyParams] = useState<ToolParam[]>([]);
  const [timeout, setTimeoutSeconds] = useState(30);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [headersTouched, setHeadersTouched] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(tool?.name || ""); setDescription(tool?.description || ""); setUrl(tool?.url || "");
    setMethod(tool?.http_method || "GET"); setPromptInstructions(tool?.prompt_instructions || "");
    setQueryParams(tool?.query_params || []); setBodyParams(tool?.body_params || []);
    setTimeoutSeconds(tool?.timeout_seconds || 30);
    setHeaderRows([]); setHeadersTouched(false); setShowHeaders(!tool?.has_headers);
  }, [open, tool]);

  const allowsBody = !["GET", "DELETE"].includes(method);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      name, description, url, http_method: method, prompt_instructions: promptInstructions,
      query_params: queryParams, body_params: allowsBody ? bodyParams : [], timeout_seconds: timeout,
    };
    if (headersTouched) payload.headers = headersToDict(headerRows);
    try {
      const saved = tool
        ? await api<AgentTool>(`/agents/${agentId}/tools/${tool.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<AgentTool>(`/agents/${agentId}/tools`, { method: "POST", body: JSON.stringify({ type: "http", ...payload }) });
      onSaved(saved);
      onClose();
    } catch (err) { toast.error(messageFrom(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} title={tool ? t("tools.http.editTitle") : t("tools.http.createTitle")} description={t("tools.http.subtitle")} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>{t("tools.form.name")}
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="search_client" pattern="[a-z][a-z0-9]*(_[a-z0-9]+)*" maxLength={40} />
            <span className="mt-1.5 text-xs text-muted-foreground">{t("tools.form.nameHint")}</span>
          </label>
          <label>{t("tools.form.description")}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("tools.form.descriptionPlaceholder")} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>{t("tools.http.url")}
            <Input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1/resource/{id}" />
            <span className="mt-1.5 text-xs text-muted-foreground">{t("tools.http.urlHint")}</span>
          </label>
          <label>{t("tools.http.method")}<Select value={method} onValueChange={(value) => value && setMethod(value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
        </div>
        <label>{t("tools.http.promptInstructions")}
          <Textarea rows={4} value={promptInstructions} onChange={(e) => setPromptInstructions(e.target.value)} placeholder={t("tools.http.promptPlaceholder")} />
        </label>
        <Alert type="info">{t("tools.http.llmNote")}</Alert>
        {allowsBody && <ParamsEditor label={t("tools.http.bodyParams")} params={bodyParams} onChange={setBodyParams} />}
        <ParamsEditor label={t("tools.http.queryParams")} params={queryParams} onChange={setQueryParams} />
        <details className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <summary>{t("tools.http.advanced")}</summary>
          <label>{t("tools.http.timeout")}
            <Input type="number" min={1} max={120} value={timeout} onChange={(e) => setTimeoutSeconds(Number(e.target.value))} />
          </label>
          <span className="mb-1.5 block text-sm font-medium">{t("tools.form.headers")}</span>
          {tool?.has_headers && !showHeaders
            ? <div className="space-y-2"><small>{t("tools.form.headersConfigured")}</small><Button type="button" variant="ghost" onClick={() => { setShowHeaders(true); setHeadersTouched(true); }}>{t("tools.form.replaceHeaders")}</Button></div>
            : <HeadersEditor rows={headerRows} onChange={(rows) => { setHeaderRows(rows); setHeadersTouched(true); }} />}
        </details>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>{t("tools.form.cancel")}</Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : tool ? <Save size={16} /> : <Zap size={16} />}
            {busy ? t("tools.form.saving") : tool ? t("tools.http.save") : t("tools.http.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

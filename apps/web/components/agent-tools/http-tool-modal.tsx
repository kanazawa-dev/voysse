"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, Plus, Save, Trash2, Zap } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { AgentTool, ToolParam } from "@/types";
import { HeadersEditor, headersToDict, type HeaderRow } from "./headers-editor";

const EMPTY_PARAM: ToolParam = { name: "", type: "string", description: "", required: false };

function ParamsEditor({ label, params, onChange }: { label: string; params: ToolParam[]; onChange: (params: ToolParam[]) => void }) {
  const t = useT();
  const update = (index: number, patch: Partial<ToolParam>) =>
    onChange(params.map((param, i) => (i === index ? { ...param, ...patch } : param)));
  return (
    <div className="params-editor">
      <div className="params-head">
        <strong>{label}</strong>
        <button type="button" className="button secondary" onClick={() => onChange([...params, { ...EMPTY_PARAM }])}>
          <Plus size={14} /> {t("tools.http.addParam")}
        </button>
      </div>
      {params.map((param, index) => (
        <div className="param-row" key={index}>
          <input placeholder={t("tools.http.paramName")} value={param.name} onChange={(e) => update(index, { name: e.target.value })} />
          <select value={param.type} onChange={(e) => update(index, { type: e.target.value as ToolParam["type"] })}>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="integer">integer</option>
            <option value="boolean">boolean</option>
          </select>
          <input placeholder={t("tools.http.paramDescription")} value={param.description} onChange={(e) => update(index, { description: e.target.value })} />
          <label className="param-required" title={t("tools.http.paramRequired")}>
            <input type="checkbox" checked={param.required} onChange={(e) => update(index, { required: e.target.checked })} />
            {t("tools.http.paramRequired")}
          </label>
          <button type="button" className="icon-button danger-icon" onClick={() => onChange(params.filter((_, i) => i !== index))} title={t("tools.delete")}>
            <Trash2 size={15} />
          </button>
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
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label>{t("tools.form.name")}
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="search_client" pattern="[a-z][a-z0-9]*(_[a-z0-9]+)*" maxLength={40} />
            <span className="field-help">{t("tools.form.nameHint")}</span>
          </label>
          <label>{t("tools.form.description")}
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("tools.form.descriptionPlaceholder")} />
          </label>
        </div>
        <div className="form-grid url-method">
          <label>{t("tools.http.url")}
            <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1/resource/{id}" />
            <span className="field-help">{t("tools.http.urlHint")}</span>
          </label>
          <label>{t("tools.http.method")}
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <label>{t("tools.http.promptInstructions")}
          <textarea rows={4} value={promptInstructions} onChange={(e) => setPromptInstructions(e.target.value)} placeholder={t("tools.http.promptPlaceholder")} />
        </label>
        <Alert type="info">{t("tools.http.llmNote")}</Alert>
        {allowsBody && <ParamsEditor label={t("tools.http.bodyParams")} params={bodyParams} onChange={setBodyParams} />}
        <ParamsEditor label={t("tools.http.queryParams")} params={queryParams} onChange={setQueryParams} />
        <details className="advanced-options">
          <summary>{t("tools.http.advanced")}</summary>
          <label>{t("tools.http.timeout")}
            <input type="number" min={1} max={120} value={timeout} onChange={(e) => setTimeoutSeconds(Number(e.target.value))} />
          </label>
          <span className="field-label">{t("tools.form.headers")}</span>
          {tool?.has_headers && !showHeaders
            ? <div className="stored-headers"><small>{t("tools.form.headersConfigured")}</small><button type="button" className="button ghost" onClick={() => { setShowHeaders(true); setHeadersTouched(true); }}>{t("tools.form.replaceHeaders")}</button></div>
            : <HeadersEditor rows={headerRows} onChange={(rows) => { setHeaderRows(rows); setHeadersTouched(true); }} />}
        </details>
        <div className="modal-actions">
          <button type="button" className="button ghost" onClick={onClose}>{t("tools.form.cancel")}</button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : tool ? <Save size={16} /> : <Zap size={16} />}
            {busy ? t("tools.form.saving") : tool ? t("tools.http.save") : t("tools.http.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

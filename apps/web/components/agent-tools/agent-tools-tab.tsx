"use client";

import { useState } from "react";
import { Pencil, Plus, Server, Trash2, Wrench, Zap } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import type { AgentTool } from "@/types";
import { HttpToolModal } from "./http-tool-modal";
import { McpServerModal } from "./mcp-server-modal";

export function AgentToolsTab({ agentId, tools, onToolsChange }: {
  agentId: string;
  tools: AgentTool[];
  onToolsChange: (tools: AgentTool[]) => void;
}) {
  const t = useT();
  const toast = useToast();
  // null = closed, "new" = create, otherwise the tool being edited.
  const [httpModal, setHttpModal] = useState<AgentTool | "new" | null>(null);
  const [mcpModal, setMcpModal] = useState<AgentTool | "new" | null>(null);

  function saved(tool: AgentTool) {
    onToolsChange(
      tools.some((item) => item.id === tool.id)
        ? tools.map((item) => (item.id === tool.id ? tool : item))
        : [...tools, tool],
    );
  }

  async function toggle(tool: AgentTool) {
    try {
      const updated = await api<AgentTool>(`/agents/${agentId}/tools/${tool.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !tool.enabled }) });
      onToolsChange(tools.map((item) => (item.id === tool.id ? updated : item)));
    } catch (err) { toast.error(messageFrom(err)); }
  }

  async function remove(tool: AgentTool) {
    if (!confirm(t("tools.confirmDelete", { name: tool.name }))) return;
    try {
      await api(`/agents/${agentId}/tools/${tool.id}`, { method: "DELETE" });
      onToolsChange(tools.filter((item) => item.id !== tool.id));
    } catch (err) { toast.error(messageFrom(err)); }
  }

  return (
    <section className="panel tools-panel">
      <div className="panel-head">
        <div><h3>{t("tools.heading")}</h3><p>{t("tools.copy")}</p></div>
        <div className="tools-actions">
          <button className="button secondary" onClick={() => setMcpModal("new")}><Server size={15} /> {t("tools.addMcp")}</button>
          <button className="button primary" onClick={() => setHttpModal("new")}><Plus size={15} /> {t("tools.addHttp")}</button>
        </div>
      </div>
      <div className="documents-list">
        {tools.map((tool) => (
          <div className="document-row" key={tool.id}>
            <span className={`document-icon ${tool.enabled ? "" : "error"}`}>{tool.type === "http" ? <Zap size={18} /> : <Server size={18} />}</span>
            <div>
              <strong>{tool.name} <span className="pill">{tool.type === "http" ? `${t("tools.badgeHttp")} · ${tool.http_method}` : t("tools.badgeMcp")}</span></strong>
              <small>{tool.type === "mcp" ? `${tool.url} · ${t("tools.mcpToolCount", { count: tool.cached_tools.length })}` : tool.description || tool.url}</small>
            </div>
            <label className="switch-row compact tool-switch" title={t("tools.enabled")}>
              <input type="checkbox" checked={tool.enabled} onChange={() => toggle(tool)} />
            </label>
            <div className="tools-row-actions">
              <button className="icon-button" onClick={() => (tool.type === "http" ? setHttpModal(tool) : setMcpModal(tool))} title={t("tools.edit")}><Pencil size={15} /></button>
              <button className="icon-button danger-icon" onClick={() => remove(tool)} title={t("tools.delete")}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {!tools.length && (
          <div className="inline-empty slim">
            <Wrench size={22} />
            <div><strong>{t("tools.emptyTitle")}</strong><span>{t("tools.emptyHint")}</span></div>
          </div>
        )}
      </div>
      <HttpToolModal agentId={agentId} tool={httpModal === "new" ? null : httpModal} open={httpModal !== null} onClose={() => setHttpModal(null)} onSaved={saved} />
      <McpServerModal agentId={agentId} tool={mcpModal === "new" ? null : mcpModal} open={mcpModal !== null} onClose={() => setMcpModal(null)} onSaved={saved} />
    </section>
  );
}

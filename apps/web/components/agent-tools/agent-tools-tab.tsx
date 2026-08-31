"use client";

import { useState } from "react";
import { Pencil, Plus, Server, Trash2, Wrench, Zap } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/toast";
import { Switch } from "@/components/ui/switch";
import type { AgentTool } from "@/types";
import { HttpToolModal } from "./http-tool-modal";
import { McpServerModal } from "./mcp-server-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <Card className="p-5 space-y-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [&_h3]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
        <div><h3 className="font-heading">{t("tools.heading")}</h3><p>{t("tools.copy")}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMcpModal("new")}><Server size={15} /> {t("tools.addMcp")}</Button>
          <Button type="button" onClick={() => setHttpModal("new")}><Plus size={15} /> {t("tools.addHttp")}</Button>
        </div>
      </div>
      <div className="divide-y">
        {tools.map((tool) => (
          <div className="flex items-center gap-3 py-3" key={tool.id}>
            <span className={`flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ${tool.enabled ? "" : "bg-destructive/10 text-destructive"}`}>{tool.type === "http" ? <Zap size={18} /> : <Server size={18} />}</span>
            <div>
              <strong>{tool.name} <span className="inline-flex rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">{tool.type === "http" ? `${t("tools.badgeHttp")} · ${tool.http_method}` : t("tools.badgeMcp")}</span></strong>
              <small>{tool.type === "mcp" ? `${tool.url} · ${t("tools.mcpToolCount", { count: tool.cached_tools.length })}` : tool.description || tool.url}</small>
            </div>
            <label className="flex items-center gap-3 text-xs text-muted-foreground" title={t("tools.enabled")}>
              <Switch checked={tool.enabled} onCheckedChange={() => toggle(tool)} aria-label={t("tools.enabled")} />
            </label>
            <div className="ml-auto flex gap-1">
              <Button type="button" size="icon" variant="ghost" onClick={() => (tool.type === "http" ? setHttpModal(tool) : setMcpModal(tool))} title={t("tools.edit")}><Pencil size={15} /></Button>
              <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => remove(tool)} title={t("tools.delete")}><Trash2 size={15} /></Button>
            </div>
          </div>
        ))}
        {!tools.length && (
          <div className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Wrench size={22} />
            <div><strong className="block">{t("tools.emptyTitle")}</strong><span className="block">{t("tools.emptyHint")}</span></div>
          </div>
        )}
      </div>
      <HttpToolModal agentId={agentId} tool={httpModal === "new" ? null : httpModal} open={httpModal !== null} onClose={() => setHttpModal(null)} onSaved={saved} />
      <McpServerModal agentId={agentId} tool={mcpModal === "new" ? null : mcpModal} open={mcpModal !== null} onClose={() => setMcpModal(null)} onSaved={saved} />
    </Card>
  );
}

"use client";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import { solutionError, type Installation, type Solution } from "@/lib/solutions";
import { InstallationPreview } from "./preview";
import type { Client } from "@/types";

export function Installations({ solution, version, onBusy }: { solution: Solution; version: number; onBusy: (busy: boolean) => void }) {
  const t = useT(), saving = useRef(false);
  const [page, setPage] = useState(0), [reload, setReload] = useState(0);
  const [data, setData] = useState<{ page: number; reload: number; clients: Client[]; rows: Installation[] } | null>(null);
  const [loadError, setLoadError] = useState<I18nKey | null>(null), [error, setError] = useState<I18nKey | null>(null);
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false);
  const [preview, setPreview] = useState<Installation | null>(null);
  const [installed, setInstalled] = useState<Installation | null>(null);
  const ready = data?.page === page && data.reload === reload;
  useEffect(() => {
    let active = true;
    Promise.all([api<Client[]>("/clients"), api<Installation[]>(`/solutions/${solution.id}/installations?limit=50&offset=${page * 50}`)])
      .then(([clients, rows]) => { if (active) { setData({ page, reload, clients, rows }); setLoadError(null); } })
      .catch(err => { if (active) setLoadError(solutionError(err)); });
    return () => { active = false; };
  }, [solution.id, page, reload]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !ready || blocked) return;
    const form = event.currentTarget, body = new FormData(form);
    if (!String(body.get("name") ?? "").trim()) { setError("solutions.invalid"); return; }
    saving.current = true; setBusy(true); onBusy(true); setError(null); setInstalled(null);
    try {
      const result = await api<Installation>(`/solutions/${solution.id}/installations`, { method: "POST",
        body: JSON.stringify({ client_id: body.get("client_id"), version_number: version, name: body.get("name") }) });
      setInstalled(result); form.reset(); setPage(0); setReload(n => n + 1);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "solutions.duplicate" :
        err instanceof ApiError && [401, 403, 422].includes(err.status) ? solutionError(err) : "solutions.uncertain");
      if (!(err instanceof ApiError) || ![401, 403, 422].includes(err.status)) setBlocked(true);
    } finally { saving.current = false; setBusy(false); onBusy(false); }
  }
  const clients = data?.clients.filter(c => c.is_active) ?? [];
  return <section className="min-w-0 space-y-4 rounded-xl border bg-card p-5" aria-busy={busy}>
    <h2 className="font-heading text-xl">{t("solutions.install")}</h2><p className="text-sm text-muted-foreground">{t("solutions.installHint")}</p>
    {loadError && <p role="alert">{t(loadError)}</p>}
    {!ready && !loadError && <p role="status">{t("solutions.loading")}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    {installed && <div role="status" className="space-y-2"><p>{t("solutions.installed")}</p>
      <Link className="text-primary underline" href={`/agents/${installed.agent_id}`}>{t("solutions.openAgent")}</Link></div>}
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={busy || !ready || !!loadError || blocked} className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-2">
          <Label htmlFor="solution-client">{t("solutions.client")}</Label>
          <select id="solution-client" name="client_id" required defaultValue="" className="h-10 w-full min-w-0 rounded-sm border bg-background px-3 text-sm">
            <option value="" disabled>{t("solutions.choose")}</option>{clients.map(client =>
              <option value={client.id} key={client.id} disabled={data?.rows.some(row => row.client_id === client.id)}>{client.name}</option>)}
          </select>
        </div><div className="min-w-0 space-y-2"><Label htmlFor="installation-name">{t("solutions.agentName")}</Label>
          <Input id="installation-name" name="name" required maxLength={180} defaultValue={solution.name} /></div></div>
        {ready && !clients.length && <p>{t("solutions.noClients")}</p>}
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1" />{t("solutions.confirmInstall")}</label>
        <Button type="submit" disabled={!clients.length}>{t(busy ? "solutions.busy" : "solutions.install")} · v{version}</Button>
      </fieldset>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><h3 className="font-medium">{t("solutions.installations")}</h3>
      <Button variant="outline" disabled={busy} onClick={() => { setReload(n => n + 1); setBlocked(false); setError(null); }}>{t("solutions.refresh")}</Button></div>
    {ready && !loadError && <>
      {!data.rows.length && <p className="text-sm text-muted-foreground">{t("solutions.noInstallations")}</p>}
      {data.rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="min-w-0 break-words">{data.clients.find(c => c.id === row.client_id)?.name ?? row.client_id} · v{row.version_number}</span>
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={() => setPreview(row)}>{t("solutionPreview.title")} · v{version}</Button>
        <Link className="text-primary underline" href={`/agents/${row.agent_id}`}>{t("solutions.openAgent")}</Link></div></div>)}
      <div className="flex justify-between gap-3"><Button variant="outline" disabled={busy || !page} onClick={() => setPage(n => n - 1)}>{t("solutions.previous")}</Button>
        <Button variant="outline" disabled={busy || data.rows.length < 50} onClick={() => setPage(n => n + 1)}>{t("solutions.next")}</Button></div>
    </>}
    {preview && <InstallationPreview key={`${preview.id}/${version}`} solutionId={solution.id} installation={preview} target={version} onClose={() => setPreview(null)} />}
  </section>;
}

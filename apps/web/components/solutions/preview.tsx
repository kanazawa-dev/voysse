"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import type { Installation, SolutionSettings } from "@/lib/solutions";

type Field = keyof SolutionSettings;
type Change = { field: Field; status: "unchanged" | "updated" | "preserved" | "conflict"; baseline: string | number; current: string | number; target: string | number };
type Preview = { installation_id: string; installed_version: number; target_version: number; revision: number; agent_updated_at: string;
  changes: Change[]; conflicts: Field[]; local_overrides: Field[]; detected_overrides: Field[]; can_apply: false };

export function InstallationPreview({ solutionId, installation, target, onClose }: {
  solutionId: string; installation: Installation; target: number; onClose: () => void;
}) {
  const t = useT(), saving = useRef(false);
  const [reload, setReload] = useState(0), [data, setData] = useState<{ reload: number; value: Preview } | null>(null);
  const [error, setError] = useState<I18nKey | null>(null), [busy, setBusy] = useState(false);
  const base = `/solutions/${solutionId}/installations/${installation.id}`;
  const ready = data?.reload === reload;
  useEffect(() => {
    let active = true;
    api<Preview>(`${base}/preview?target_version=${target}`).then(value => {
      if (active) { setData({ reload, value }); setError(null); }
    }).catch(err => { if (active) setError(err instanceof ApiError && err.status === 422 ? "solutionPreview.invalid" : "solutionPreview.error"); });
    return () => { active = false; };
  }, [base, target, reload]);
  async function protect(field: Field) {
    if (saving.current || !ready || error) return;
    saving.current = true; setBusy(true);
    try {
      await api(`${base}/protected-fields`, { method: "POST", body: JSON.stringify({ field,
        expected_revision: data.value.revision, expected_agent_updated_at: data.value.agent_updated_at }) });
      setReload(n => n + 1);
    } catch { setError("solutionPreview.stale"); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Modal open title={t("solutionPreview.title")} description={t("solutionPreview.hint")} onClose={() => { if (!saving.current) onClose(); }}>
    <div className="min-w-0 space-y-4" aria-busy={busy || !ready}>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {!ready && !error && <p role="status">{t("solutions.loading")}</p>}
      {ready && <>
        <h3 className="font-medium">{t("solutionPreview.fromTo", { from: data.value.installed_version, to: data.value.target_version })}</h3>
        <p role="status" className="text-sm">{t(data.value.conflicts.length ? "solutionPreview.conflicts" : "solutionPreview.clean")}</p>
        <p className="text-sm text-muted-foreground">{t("solutionPreview.protectHint")}</p>
        {data.value.changes.map(change => <section key={change.field} className="min-w-0 space-y-3 rounded-lg border p-3">
          <h4 className="font-medium">{t(`solutions.${change.field}`)}</h4>
          <p className="text-sm">{t(`solutionPreview.${change.status}`)}</p>
          <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">{(["baseline", "current", "target"] as const).map(key =>
            <div key={key} className="min-w-0"><dt className="text-muted-foreground">{t(`solutionPreview.${key}`)}</dt>
              <dd className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">{String(change[key]) || "—"}</dd></div>)}</dl>
          {data.value.local_overrides.includes(change.field) ? <p className="text-sm">{t("solutionPreview.protected")}</p> : <>
            {data.value.detected_overrides.includes(change.field) && <p className="text-sm">{t("solutionPreview.detected")}</p>}
            <Button className="h-auto min-h-9 whitespace-normal" variant="outline" disabled={busy || !!error} onClick={() => void protect(change.field)}>{t("solutionPreview.protect")}</Button>
          </>}
        </section>)}
      </>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => { setError(null); setReload(n => n + 1); }}>{t("solutions.refresh")}</Button>
        <Button variant="outline" disabled={busy} onClick={onClose}>{t("solutions.cancel")}</Button>
      </div>
    </div>
  </Modal>;
}

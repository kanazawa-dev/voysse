"use client";
import { FormEvent, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import { emptySettings, solutionError, type Solution, type SolutionVersion } from "@/lib/solutions";
import { SettingsFields, SettingsSummary, readSettings } from "./settings-fields";

type Props = { onClose: () => void } & (
  { solution?: never; source?: never; onCreated: (solution: Solution) => void; onPublished?: never } |
  { solution: Solution; source: SolutionVersion; onPublished: (version: SolutionVersion) => void; onCreated?: never }
);
export function SolutionEditor(props: Props) {
  const t = useT(), saving = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<I18nKey | null>(null);
  const [blocked, setBlocked] = useState<"conflict" | "uncertain" | null>(null);
  const [expected, setExpected] = useState(props.solution?.latest_version ?? 0);
  const [reviewed, setReviewed] = useState<SolutionVersion | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || blocked) return;
    const data = new FormData(event.currentTarget), settings = readSettings(data);
    if (props.onCreated && !String(data.get("name") ?? "").trim()) { setError("solutions.invalid"); return; }
    saving.current = true; setBusy(true); setError(null);
    try {
      if (props.solution) props.onPublished(await api<SolutionVersion>(`/solutions/${props.solution.id}/versions`, {
        method: "POST", body: JSON.stringify({ expected_latest_version: expected, settings }),
      }));
      else props.onCreated(await api<Solution>("/solutions", { method: "POST", body: JSON.stringify({ name: data.get("name"), settings }) }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && props.solution) {
        setBlocked("conflict"); setReviewed(null); setError("solutions.conflict");
      } else if (err instanceof ApiError && [401, 403, 422].includes(err.status)) setError(solutionError(err));
      else { setBlocked("uncertain"); setError("solutions.uncertain"); }
    } finally { saving.current = false; setBusy(false); }
  }
  async function inspectLatest() {
    if (!props.solution || saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const [latest] = await api<{ number: number }[]>(`/solutions/${props.solution.id}/versions?limit=1`);
      if (!latest) throw new Error("Version missing");
      setReviewed(await api<SolutionVersion>(`/solutions/${props.solution.id}/versions/${latest.number}`));
      setError("solutions.conflict");
    } catch (err) { setError(solutionError(err)); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Modal open title={t(props.solution ? "solutions.publish" : "solutions.create")} description={t("solutions.immutable")}
    onClose={() => { if (!saving.current) props.onClose(); }}>
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {props.solution ? <p>{t("solutions.editSource", { number: props.source.number })}</p> : <div className="space-y-2">
          <Label htmlFor="solution-name">{t("solutions.name")}</Label><Input id="solution-name" name="name" required maxLength={180} autoFocus />
        </div>}
        <SettingsFields value={props.source?.settings ?? emptySettings} />
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1" />{t("solutions.review")}</label>
      </fieldset>
      {blocked === "conflict" && <div className="space-y-3 rounded-lg border p-3">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void inspectLatest()}>{t("solutions.inspect")}</Button>
        {reviewed && <><h3 className="font-medium">{t("solutions.latestContent")} · v{reviewed.number}</h3>
          <SettingsSummary value={reviewed.settings} />
          <Button className="h-auto min-h-11 whitespace-normal" type="button" disabled={busy} onClick={() => {
            setExpected(reviewed.number); setBlocked(null); setReviewed(null); setError(null);
          }}>{t("solutions.reviewed")}</Button></>}
      </div>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={props.onClose}>{t("solutions.cancel")}</Button>
        <Button type="submit" disabled={busy || !!blocked}>{t(busy ? "solutions.busy" : props.solution ? "solutions.publish" : "solutions.save")}</Button>
      </div>
    </form>
  </Modal>;
}

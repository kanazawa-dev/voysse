"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui";
import { api } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import { solutionError, type Solution, type SolutionVersion } from "@/lib/solutions";
import { SolutionEditor } from "./editor";
import { Installations } from "./installations";
import { SettingsSummary } from "./settings-fields";

export function SolutionDetail({ solution, onBack, onLatest }: {
  solution: Solution; onBack: () => void; onLatest: (number: number) => void;
}) {
  const t = useT();
  const [number, setNumber] = useState(solution.latest_version), [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  return <section className="min-w-0 space-y-6">
    <Button variant="outline" disabled={busy} onClick={onBack}>{t("solutions.back")}</Button>
    <PageHead title={solution.name} description={t("solutions.immutable")} />
    {notice && <p role="status">{t("solutions.published")}</p>}
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={t("solutions.versions")}>
      <Button variant="outline" disabled={busy || number <= 1} onClick={() => setNumber(n => n - 1)}>{t("solutions.previous")}</Button>
      <h2 className="font-medium">{t("solutions.version", { number })}</h2>
      <Button variant="outline" disabled={busy || number >= solution.latest_version} onClick={() => setNumber(n => n + 1)}>{t("solutions.next")}</Button>
      <span className="text-sm text-muted-foreground">{t("solutions.current", { number: solution.latest_version })}</span>
    </div>
    <VersionView key={`${solution.id}/${number}`} solution={solution} number={number} onBusy={setBusy} onPublished={version => {
      onLatest(version.number); setNumber(version.number); setNotice(true);
    }} />
  </section>;
}

function VersionView({ solution, number, onPublished, onBusy }: {
  solution: Solution; number: number; onPublished: (version: SolutionVersion) => void; onBusy: (busy: boolean) => void;
}) {
  const t = useT();
  const [version, setVersion] = useState<SolutionVersion | null>(null), [editing, setEditing] = useState(false);
  const [error, setError] = useState<I18nKey | null>(null), [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<SolutionVersion>(`/solutions/${solution.id}/versions/${number}`).then(value => {
      if (active) { setVersion(value); setError(null); }
    }).catch(err => { if (active) setError(solutionError(err)); });
    return () => { active = false; };
  }, [solution.id, number, reload]);
  if (error) return <div role="alert"><p>{t(error)}</p><Button onClick={() => setReload(n => n + 1)}>{t("solutions.retry")}</Button></div>;
  if (!version) return <p role="status">{t("solutions.loading")}</p>;
  return <div className="min-w-0 space-y-6">
    <div className="min-w-0 space-y-4 rounded-xl border bg-card p-5">
      <SettingsSummary value={version.settings} />
      <Button disabled={busy} onClick={() => setEditing(true)}>{t("solutions.publish")}</Button>
    </div>
    <Installations solution={solution} version={number} onBusy={value => { setBusy(value); onBusy(value); }} />
    {editing && <SolutionEditor solution={solution} source={version} onClose={() => setEditing(false)} onPublished={onPublished} />}
  </div>;
}

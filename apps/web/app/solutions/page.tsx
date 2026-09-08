"use client";
import { useEffect, useState } from "react";
import { Library, Plus } from "lucide-react";
import { EmptyState, PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { SolutionEditor } from "@/components/solutions/editor";
import { SolutionDetail } from "@/components/solutions/detail";
import { api } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import { solutionError, type Solution } from "@/lib/solutions";

export default function SolutionsPage() {
  const t = useT();
  const [page, setPage] = useState(0), [reload, setReload] = useState(0);
  const [data, setData] = useState<{ page: number; reload: number; rows: Solution[] } | null>(null);
  const [error, setError] = useState<I18nKey | null>(null), [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Solution | null>(null), [notice, setNotice] = useState(false);
  const loading = !data || data.page !== page || data.reload !== reload;
  useEffect(() => {
    let active = true;
    api<Solution[]>(`/solutions?limit=50&offset=${page * 50}`).then(rows => {
      if (active) { setData({ page, reload, rows }); setError(null); }
    }).catch(err => { if (active) setError(solutionError(err)); });
    return () => { active = false; };
  }, [page, reload]);
  if (selected) return <SolutionDetail key={selected.id} solution={selected}
    onBack={() => { setSelected(null); setNotice(false); setReload(n => n + 1); }}
    onLatest={number => setSelected({ ...selected, latest_version: number })} />;
  return <div className="min-w-0 space-y-6">
    <PageHead title={t("solutions.title")} description={t("solutions.description")} action={
      <Button onClick={() => setCreating(true)}><Plus />{t("solutions.create")}</Button>} />
    {notice && <p role="status">{t("solutions.created")}</p>}
    {error ? <div role="alert" className="space-y-2"><p>{t(error)}</p><Button variant="outline" onClick={() => setReload(n => n + 1)}>{t("solutions.retry")}</Button></div>
      : loading ? <p role="status">{t("solutions.loading")}</p> : <>
        {data.rows.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.rows.map(solution =>
          <button key={solution.id} onClick={() => setSelected(solution)} className="min-w-0 rounded-xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
            <Library className="mb-4 text-primary" size={22} /><h2 className="break-words font-heading text-lg font-medium">{solution.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("solutions.current", { number: solution.latest_version })}</p>
          </button>)}</div> : <EmptyState icon={<Library />} title={t("solutions.empty")} description={t("solutions.emptyHint")} />}
        <div className="flex justify-between gap-3"><Button variant="outline" disabled={!page} onClick={() => setPage(n => n - 1)}>{t("solutions.previous")}</Button>
          <Button variant="outline" disabled={data.rows.length < 50} onClick={() => setPage(n => n + 1)}>{t("solutions.next")}</Button></div>
      </>}
    {creating && <SolutionEditor onClose={() => setCreating(false)} onCreated={() => {
      setCreating(false); setPage(0); setNotice(true); setReload(n => n + 1);
    }} />}
  </div>;
}

"use client";
import { useEffect, useRef, useState } from 'react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { StudioGraph } from './types';
import styles from './studio.module.css';

type Policy = { rules: { source_agent_id: string; target_agent_id: string | null; condition: string }[]; max_hops: number; human_fallback: true };
type Draft = Policy & { revision: number; valid: boolean };
type Action = 'publish' | 'restore' | 'unpublish';
type Version = { id: string; revision: number; actor_id: string; created_at: string; policy: Policy | null; request: { action: Action; reason: string; draft_revision?: number; restore_revision?: number } };
type History = { items: Version[]; has_more: boolean };
const signature = (p: Policy) => JSON.stringify([p.max_hops, p.human_fallback, p.rules.map(r => [r.source_agent_id, r.target_agent_id, r.condition])]);
export function PolicyPanel({ data, draft }: { data: StudioGraph; draft: Draft }) {
  const { lang } = useLanguage(), es = lang === 'es';
  const [history, setHistory] = useState<History | null>(null), [current, setCurrent] = useState<Version | null>(null);
  const [choice, setChoice] = useState<{ action: Action; version?: Version } | null>(null), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (choice) form.current?.focus(); }, [choice]);
  const endpoint = `/studio/${data.client.id}/policies`;
  const same = !!current?.policy && signature(current.policy) === signature(draft);
  const label = (action: Action) => ({ publish: es ? 'Publicar borrador guardado' : 'Publish saved draft', restore: es ? 'Restaurar versión' : 'Restore version', unpublish: es ? 'Retirar publicación' : 'Unpublish' })[action];
  const name = (id: string | null) => id === null ? (es ? 'Atención humana' : 'Human attention') : data.agents.find(a => a.id === id)?.name || id;
  const summary = (policy: Policy | null) => policy ? <><p>{es ? 'Máximo de saltos' : 'Maximum hops'}: {policy.max_hops} · {es ? 'Salida humana obligatoria' : 'Required human fallback'}</p><ol>{policy.rules.map((r, i) => <li key={i}>{i + 1}. {name(r.source_agent_id)} → {name(r.target_agent_id)}<p>{r.condition}</p></li>)}</ol>{!policy.rules.length && <p>{es ? 'Sin reglas' : 'No rules'}</p>}</> : <p>{es ? 'Sin política publicada' : 'No published policy'}</p>;
  async function load(older = false) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const before = older ? history?.items.at(-1)?.revision : undefined;
      const value = await api<History>(`${endpoint}?limit=10${before ? `&before_revision=${before}` : ''}`, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setHistory({ ...value, items: older ? [...history!.items, ...value.items] : value.items });
        if (!older) setCurrent(value.items[0] || null);
      }
    } catch (err) { if (!controller.signal.aborted) { setHistory(null); setCurrent(null); setError(messageFrom(err)); } }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  async function apply() {
    if (request.current || !history || !choice || !reason.trim()) return;
    if (!window.confirm(`${label(choice.action)}${choice.version ? ` ${choice.version.revision}` : ''}?\n\n${es ? 'Se creará una nueva revisión. No activa derivaciones ni modifica el borrador o conversaciones.' : 'Creates a new revision. Does not enable handoffs or change the draft or conversations.'}`)) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ version: Version }>(endpoint, { method: 'POST', signal: controller.signal, body: JSON.stringify({
        request_id: crypto.randomUUID(), action: choice.action, expected_revision: current?.revision || 0, reason: reason.trim(),
        ...(choice.action === 'publish' ? { draft_revision: draft.revision } : choice.action === 'restore' ? { restore_revision: choice.version!.revision } : {}),
      }) });
      if (!controller.signal.aborted) setNotice(es ? `Revisión ${result.version.revision} registrada. Recarga el historial para verificar el estado actual.` : `Revision ${result.version.revision} recorded. Reload history to verify current state.`);
    } catch (err) { if (!controller.signal.aborted) setError(messageFrom(err) + (es ? ' No se reintentó. Recarga historial y borrador para comprobar el resultado.' : ' Not retried. Reload history and draft to check the outcome.')); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); setHistory(null); setCurrent(null); setChoice(null); setReason(''); } }
  }
  function choose(action: Action, version?: Version) { setChoice({ action, version }); setReason(''); setError(''); setNotice(''); }
  return <section className={`${styles.preview} ${styles.execution}`} data-policy-panel aria-labelledby="policy-title">
    <h3 id="policy-title">{es ? 'Versiones publicadas' : 'Published versions'}</h3>
    <p>{es ? 'Publicar guarda una versión independiente. Las derivaciones reales siguen desactivadas. Cancelar o salir no cancela solicitudes ya enviadas.' : 'Publishing saves a separate version. Live handoffs remain disabled. Cancelling or leaving cannot cancel requests already sent.'}</p>
    <Button variant="outline" disabled={busy || !!choice} onClick={() => void load()}>{busy ? (es ? 'Procesando…' : 'Working…') : (es ? 'Cargar historial' : 'Load history')}</Button>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {history && <>
      <p role="status">{es ? 'Revisión publicada actual' : 'Current publication revision'}: {current?.revision || 0} · {same ? (es ? 'Coincide con el borrador guardado' : 'Matches saved draft') : (es ? 'Difiere del borrador guardado' : 'Differs from saved draft')}</p>
      <div className={styles.policyCompare}><div><h4>{es ? 'Borrador guardado' : 'Saved draft'} · {draft.revision}</h4>{summary(draft)}</div><div><h4>{es ? 'Publicación actual' : 'Current publication'}</h4>{summary(current?.policy || null)}</div></div>
      {!draft.valid && <p>{es ? 'El borrador no es válido: corrígelo y guárdalo antes de publicar.' : 'Invalid draft: correct and save it before publishing.'}</p>}
      <div className={styles.actions}><Button disabled={busy || !!choice || same || !draft.valid || !data.client.is_active} onClick={() => choose('publish')}>{label('publish')}</Button><Button variant="outline" disabled={busy || !!choice || !current?.policy} onClick={() => choose('unpublish')}>{label('unpublish')}</Button></div>
      {!history.items.length && <p>{es ? 'No hay versiones registradas.' : 'No recorded versions.'}</p>}
      {history.items.map(version => <article key={version.id} className={styles.handoffRule}>
        <h4>{es ? 'Revisión' : 'Revision'} {version.revision} · {label(version.request.action)}</h4>
        <p>{new Date(version.created_at).toLocaleString(es ? 'es-CL' : 'en-US')} · {es ? 'Autor' : 'Actor'}: {version.actor_id}</p><p>{version.request.reason}</p>
        <details><summary>{es ? 'Ver reglas de esta versión' : 'View rules for this version'}</summary>{summary(version.policy)}</details>
        {version.policy && <Button variant="outline" disabled={busy || !!choice || !data.client.is_active || version.revision === current?.revision} onClick={() => choose('restore', version)}>{label('restore')} {version.revision}</Button>}
      </article>)}
      {history.has_more && <Button variant="outline" disabled={busy || !!choice} onClick={() => void load(true)}>{es ? 'Cargar anteriores' : 'Load older versions'}</Button>}
    </>}
    {choice && <form ref={form} tabIndex={-1} className={styles.form} onSubmit={event => { event.preventDefault(); void apply(); }}>
      <h4>{label(choice.action)} {choice.version?.revision}</h4>
      {choice.version && summary(choice.version.policy)}
      <p>{choice.action === 'restore' ? (es ? 'Restaurar crea otra revisión sin sobrescribir el borrador. Se revalidan las referencias, sin restaurar credenciales ni configuraciones antiguas de agentes.' : 'Restore creates another revision without overwriting the draft. References are revalidated without restoring old agent settings or credentials.') : choice.action === 'publish' ? (es ? `Se publicará el borrador guardado ${draft.revision}; no se activarán derivaciones.` : `Saved draft ${draft.revision} will be published; handoffs will not be enabled.`) : (es ? 'Se retirará la publicación actual, conservando el historial y el borrador.' : 'The current publication will be withdrawn, keeping history and the draft.')}</p>
      <fieldset disabled={busy} className={styles.handoffFields}><label>{es ? 'Motivo (sin secretos)' : 'Reason (no secrets)'}<Textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <div className={styles.actions}><Button type="submit" disabled={!reason.trim()}>{es ? 'Confirmar cambio de versión' : 'Confirm version change'}</Button><Button type="button" variant="outline" onClick={() => setChoice(null)}>{es ? 'Cancelar' : 'Cancel'}</Button></div>
      </fieldset>
    </form>}
  </section>;
}

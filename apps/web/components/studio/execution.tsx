"use client";
import { useEffect, useRef, useState } from 'react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { StudioGraph } from './types';
import styles from './studio.module.css';

type Entry = { id: string; kind?: string; actor_id?: string; reason: string; source_id: string | null; target_id: string | null; revision: number; reviewed_at?: string; previous_status?: string };
type Turn = { turn_id: string; conversation_id: string; status: string; created_at: string; current_revision: number; current_responder_id: string | null; active_turn_id: string | null; transitions: Entry[] };
type Listing = { items: Turn[]; has_more: boolean; runtime_enabled: boolean };
export function ExecutionPanel({ data }: { data: StudioGraph }) {
  const { lang } = useLanguage(), es = lang === 'es';
  const [listing, setListing] = useState<Listing | null>(null), [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Turn | null>(null), [reason, setReason] = useState(''), [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (selected) form.current?.focus(); }, [selected]);
  const name = (id: string | null) => id ? data.agents.find(a => a.id === id)?.name || id : (es ? 'Sin agente / humano' : 'No agent / human');
  const status = (value: string) => ({ running: es ? 'En curso' : 'Running', uncertain: es ? 'Resultado incierto' : 'Uncertain outcome', completed: es ? 'Completado' : 'Completed', human: es ? 'Atención humana' : 'Human attention', reviewed_human: es ? 'Revisado · atención humana' : 'Reviewed · human attention' })[value] || value;
  async function load(next = 0) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setListing(null); setSelected(null);
    try {
      const value = await api<Listing>(`/studio/${data.client.id}/execution?limit=10&offset=${next}`, { signal: controller.signal });
      if (!controller.signal.aborted) { setListing(value); setOffset(next); }
    } catch (err) { if (!controller.signal.aborted) setError(messageFrom(err)); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  async function review() {
    if (request.current || !selected || !reason.trim() || !ack) return;
    if (!window.confirm(es ? '¿Cerrar este turno hacia atención humana? Esto no cancela acciones externas en curso ni permite reintentos automáticos.' : 'Close this turn toward human attention? This cannot cancel external actions in flight or allow automatic retries.')) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      await api(`/studio/${data.client.id}/execution/${selected.conversation_id}/${selected.turn_id}/review-human`, { method: 'POST', signal: controller.signal,
        body: JSON.stringify({ request_id: crypto.randomUUID(), expected_revision: selected.current_revision, reason: reason.trim(), acknowledge_external_effects: true }) });
      if (!controller.signal.aborted) setNotice(es ? 'Revisión guardada. Carga los turnos para ver el registro actualizado.' : 'Review saved. Load turns to see the updated audit.');
    } catch (err) { if (!controller.signal.aborted) setError(messageFrom(err) + (es ? ' No se reintentó. Carga los turnos para comprobar el resultado antes de otra acción.' : ' Not retried. Load turns to check the outcome before another action.')); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); setSelected(null); setListing(null); setReason(''); setAck(false); } }
  }
  return <section className={`${styles.panel} ${styles.execution}`} data-execution-panel aria-labelledby="execution-title">
    <h2 id="execution-title">{es ? 'Revisión de ejecuciones' : 'Execution review'}</h2>
    <p>{es ? 'Las derivaciones reales aún no están activadas. Este registro no controla los canales actuales ni muestra las simulaciones.' : 'Live handoffs are not enabled yet. This ledger does not control current channels or show simulations.'}</p>
    <div className={styles.actions}><Button variant="outline" disabled={busy || !!selected} onClick={() => { setNotice(''); void load(); }}>{busy ? (es ? 'Procesando…' : 'Working…') : (es ? 'Cargar turnos' : 'Load turns')}</Button></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {listing && <>
      {!listing.items.length && <p role="status">{es ? 'Todavía no hay turnos de ejecución registrados. Las pruebas de Studio no crean turnos reales.' : 'No execution turns recorded yet. Studio simulations do not create real turns.'}</p>}
      {listing.items.map(turn => <article key={turn.turn_id} className={styles.handoffRule}>
        <h3>{status(turn.status)}</h3>
        <p>{es ? 'Conversación' : 'Conversation'}: {turn.conversation_id}<br />{es ? 'Turno' : 'Turn'}: {turn.turn_id}</p>
        <p>{new Date(turn.created_at).toLocaleString(es ? 'es-CL' : 'en-US')} · {es ? 'Revisión actual' : 'Current revision'}: {turn.current_revision}<br />{es ? 'Responsable actual' : 'Current responder'}: {name(turn.current_responder_id)}</p>
        <details><summary>{es ? 'Ver registro' : 'View audit'} ({turn.transitions.length})</summary>
          {!turn.transitions.length && <p>{es ? 'Sin transiciones registradas.' : 'No transitions recorded.'}</p>}
          <ol>{turn.transitions.map(entry => <li key={entry.id}>
            <p>{name(entry.source_id)} → {name(entry.target_id)} · {es ? 'Revisión' : 'Revision'} {entry.revision}</p><p>{entry.reason}</p>
            {entry.actor_id && <p>{es ? 'Revisado por' : 'Reviewed by'}: {entry.actor_id} · {entry.reviewed_at}<br />{es ? 'Estado anterior' : 'Previous status'}: {status(entry.previous_status || '')}</p>}
          </li>)}</ol>
        </details>
        {['running', 'uncertain'].includes(turn.status) && turn.active_turn_id === turn.turn_id && <Button variant="outline" disabled={busy || !!selected || !data.client.is_active} onClick={() => { setSelected(turn); setReason(''); setAck(false); setError(''); setNotice(''); }}>{es ? 'Revisar hacia humano' : 'Review toward human'}</Button>}
      </article>)}
      <div className={styles.actions}><Button variant="outline" disabled={busy || !!selected || offset === 0} onClick={() => void load(offset - 10)}>{es ? 'Anterior' : 'Previous'}</Button><Button variant="outline" disabled={busy || !!selected || !listing.has_more || offset >= 10000} onClick={() => void load(offset + 10)}>{es ? 'Siguiente' : 'Next'}</Button></div>
    </>}
    {selected && <form ref={form} tabIndex={-1} className={styles.form} onSubmit={event => { event.preventDefault(); void review(); }}>
      <h3>{es ? 'Confirmar revisión humana' : 'Confirm human review'}</h3><p>{es ? 'Turno' : 'Turn'}: {selected.turn_id}</p>
      <p>{es ? 'Revisa primero los registros del proveedor y del canal. Esto cierra el turno, pero no cancela herramientas, llamadas o envíos que ya estén en curso. No pegues credenciales en el motivo.' : 'Check provider and channel logs first. This closes the turn but cannot cancel tools, calls or sends already in flight. Do not paste credentials in the reason.'}</p>
      <fieldset disabled={busy} className={styles.handoffFields}>
        <label>{es ? 'Motivo de revisión' : 'Review reason'}<Textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className={styles.check}><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />{es ? 'Entiendo que puede haber efectos externos pendientes y que no se reintentará el turno.' : 'I understand external effects may still be pending and the turn will not be retried.'}</label>
        <div className={styles.actions}><Button type="submit" disabled={!ack || !reason.trim()}>{es ? 'Cerrar hacia humano' : 'Close toward human'}</Button><Button type="button" variant="outline" onClick={() => setSelected(null)}>{es ? 'Cancelar' : 'Cancel'}</Button></div>
      </fieldset>
    </form>}
  </section>;
}

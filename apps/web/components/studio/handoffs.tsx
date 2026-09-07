"use client";
import { useEffect, useRef, useState } from 'react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PolicyPanel } from './policies';
import { RoutingSimulation } from './simulation';
import type { StudioGraph } from './types';
import styles from './studio.module.css';

type Rule = { source_agent_id: string; target_agent_id: string | null; condition: string };
type Draft = { rules: Rule[]; max_hops: number; human_fallback: true; revision: number; valid: boolean; problems: string[] };
export function HandoffEditor({ data }: { data: StudioGraph }) {
  const { lang } = useLanguage();
  const es = lang === 'es';
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const lock = useRef(false);
  const loadVersion = useRef(0);
  const endpoint = `/studio/${data.client.id}/handoffs`;
  const agents = data.agents.filter(a => a.is_active);
  const name = (id: string | null) => id === null ? (es ? 'Atención humana' : 'Human attention') : data.agents.find(a => a.id === id)?.name || (es ? 'Agente no disponible' : 'Unavailable agent');
  useEffect(() => {
    const controller = new AbortController();
    const version = ++loadVersion.current;
    api<Draft>(endpoint, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted && version === loadVersion.current) setDraft(value);
    }).catch(err => { if (!controller.signal.aborted && version === loadVersion.current) setError(messageFrom(err)); });
    return () => controller.abort();
  }, [endpoint]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function edit(next: Draft) {
    setDraft(next); setDirty(true); setNotice(''); setPath([]); setFinished(false);
  }
  async function sync(save: boolean) {
    if (lock.current || (save && !draft)) return;
    if (!save && dirty && !window.confirm(es ? '¿Descartar los cambios locales y cargar el borrador guardado?' : 'Discard local changes and load the saved draft?')) return;
    lock.current = true; loadVersion.current++; setBusy(true); setError(''); setNotice('');
    try {
      const value = await api<Draft>(endpoint, save ? { method: 'PUT', body: JSON.stringify({
        expected_revision: draft!.revision, rules: draft!.rules, max_hops: draft!.max_hops, human_fallback: true,
      }) } : undefined);
      setDraft(value); setDirty(false); setPath([]); setFinished(false);
      setNotice(save ? (es ? 'Borrador guardado. No se activaron derivaciones.' : 'Draft saved. Handoffs remain inactive.') : '');
    } catch (err) {
      setError(messageFrom(err) + (es ? ' Tus cambios se conservan; recarga para resolver conflictos.' : ' Your edits are preserved; reload to resolve conflicts.'));
    } finally { lock.current = false; setBusy(false); }
  }
  const available = (id: string | null) => id === null || agents.some(a => a.id === id);
  const current = path.at(-1);
  const choices = draft?.rules.filter(r => r.source_agent_id === current) || [];
  const invalid = draft?.rules.some(r => !available(r.source_agent_id) || !available(r.target_agent_id));
  return <section className={styles.panel} data-handoff-editor data-studio-busy={busy} data-studio-dirty={dirty} aria-labelledby="handoff-title">
    <h2 id="handoff-title">{es ? 'Derivaciones entre agentes' : 'Agent handoffs'}</h2>
    <p>{es ? 'Borrador · Sin activar. Define conexiones sin cambiar conversaciones reales.' : 'Draft · Inactive. Define connections without changing real conversations.'}</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!draft ? <Button variant="outline" disabled={busy} onClick={() => void sync(false)}>{es ? 'Cargar borrador' : 'Load draft'}</Button> : <>
      <p>{es ? 'Versión' : 'Revision'} {draft.revision} · {dirty ? (es ? 'Cambios sin guardar' : 'Unsaved changes') : (es ? 'Guardado' : 'Saved')}</p>
      {(!draft.valid || invalid) && <p role="alert">{es ? 'Revisa el borrador: puede contener conexiones o agentes no válidos.' : 'Review the draft: connections or agents may be invalid.'}</p>}
      <form className={styles.form} onSubmit={event => { event.preventDefault(); void sync(true); }}>
        <fieldset disabled={busy} className={styles.handoffFields}>
          <label>{es ? 'Máximo de saltos' : 'Maximum hops'}<select value={draft.max_hops} onChange={event => edit({ ...draft, max_hops: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
          <p>{es ? 'La salida a atención humana siempre está disponible.' : 'Human fallback is always available.'}</p>
          {draft.rules.map((rule, index) => <fieldset key={index} className={styles.handoffRule}>
            <legend>{es ? 'Conexión' : 'Connection'} {index + 1} · {es ? 'Borrador' : 'Draft'}</legend>
            {(['source_agent_id', 'target_agent_id'] as const).map(field => <label key={field}>
              {field === 'source_agent_id' ? (es ? 'Desde' : 'From') : (es ? 'Hacia' : 'To')}
              <select required={field === 'source_agent_id'} value={rule[field] || ''} onChange={event => edit({ ...draft, rules: draft.rules.map((r, i) => i === index ? { ...r, [field]: event.target.value || null } : r) })}>
                {field === 'target_agent_id' && <option value="">{name(null)}</option>}
                {!available(rule[field]) && <option value={rule[field]!}>{name(rule[field])}</option>}
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>)}
            <label>{es ? 'Cuándo derivar (descripción)' : 'When to hand off (description)'}<Textarea required maxLength={1000} value={rule.condition} onChange={event => edit({ ...draft, rules: draft.rules.map((r, i) => i === index ? { ...r, condition: event.target.value } : r) })} /></label>
            <Button type="button" variant="ghost" onClick={() => edit({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })}>{es ? 'Eliminar conexión' : 'Remove connection'} {index + 1}</Button>
          </fieldset>)}
          {!draft.rules.length && <p>{es ? 'Todavía no hay conexiones entre agentes.' : 'No agent connections yet.'}</p>}
          <div className={styles.actions}>
            <Button type="button" variant="outline" disabled={!agents.length || draft.rules.length >= 32} onClick={() => edit({ ...draft, rules: [...draft.rules, { source_agent_id: agents[0].id, target_agent_id: null, condition: '' }] })}>{es ? 'Añadir conexión' : 'Add connection'}</Button>
            <Button type="submit" disabled={!dirty}>{es ? 'Guardar borrador' : 'Save draft'}</Button>
            <Button type="button" variant="outline" onClick={() => void sync(false)}>{es ? 'Recargar borrador' : 'Reload draft'}</Button>
          </div>
        </fieldset>
      </form>
      <div className={styles.preview}>
        <h3>{es ? 'Ensayar recorrido' : 'Rehearse path'}</h3>
        <p>{es ? 'Recorrido manual del borrador guardado: tú eliges la regla. No evalúa condiciones con IA ni envía mensajes.' : 'Manual walkthrough of the saved draft: you choose the rule. No AI condition evaluation or messages.'}</p>
        {dirty && <p>{es ? 'Guarda los cambios antes de ensayar.' : 'Save changes before rehearsing.'}</p>}
        <fieldset disabled={busy || dirty || !draft.valid || invalid} className={styles.handoffFields}>
          <label>{es ? 'Comenzar con' : 'Start with'}<select aria-label={es ? 'Comenzar con' : 'Start with'} value={path[0] || ''} onChange={event => { setPath(event.target.value ? [event.target.value] : []); setFinished(false); }}>
            <option value="">{es ? 'Elige un agente' : 'Choose an agent'}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
          {!!path.length && <>
            <p className={styles.handoffPath} role="status">{path.map(name).join(' → ')}{finished ? ` → ${name(null)}` : ''}</p>
            {!finished && (path.length - 1 >= draft.max_hops || !choices.length) && <p>{es ? 'Límite alcanzado o sin reglas: continúa con atención humana.' : 'Hop limit reached or no rules: continue with human attention.'}</p>}
            {!finished && <div className={styles.actions}>
              {path.length - 1 < draft.max_hops && choices.map((rule, i) => <Button key={i} type="button" variant="outline" disabled={rule.target_agent_id !== null && path.includes(rule.target_agent_id)} onClick={() => rule.target_agent_id === null ? setFinished(true) : setPath([...path, rule.target_agent_id])}>
                {rule.condition} → {name(rule.target_agent_id)}
              </Button>)}
              <Button type="button" onClick={() => setFinished(true)}>{es ? 'Pasar a atención humana' : 'Go to human attention'}</Button>
            </div>}
          </>}
        </fieldset>
      </div>
      {!dirty && !busy ? <PolicyPanel key={'policy:' + String(draft.revision) + data.agents.map(a => a.updated_at).join()} data={data} draft={{ ...draft, valid: draft.valid && !invalid }} /> : <p>{es ? 'Guarda o recarga el borrador para administrar versiones publicadas.' : 'Save or reload the draft to manage published versions.'}</p>}
      {!dirty && !busy && draft.valid && !invalid && <RoutingSimulation key={'simulation:' + String(draft.revision) + data.agents.map(a => a.updated_at).join()} data={data} revision={draft.revision} maxHops={draft.max_hops} />}
    </>}
  </section>;
}

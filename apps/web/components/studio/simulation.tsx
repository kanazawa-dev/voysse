"use client";
import { useEffect, useRef, useState } from 'react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { StudioGraph } from './types';
import styles from './studio.module.css';

type Result = { revision: number; source_agent_id: string; target_agent_id: string | null; condition: string | null; reason: string; outcome: 'matched' | 'no_rules' | 'human_fallback' | 'invalid_response' };
type Chain = { revision: number; steps: Result[]; outcome: string; max_hops: number };
export function RoutingSimulation({ data, revision, maxHops }: { data: StudioGraph; revision: number; maxHops: number }) {
  const { lang } = useLanguage(), es = lang === 'es';
  const [source, setSource] = useState(''), [message, setMessage] = useState('');
  const [chain, setChain] = useState(false);
  const [result, setResult] = useState<Result | Chain | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const name = (id: string | null) => id === null ? (es ? 'Atención humana' : 'Human attention') : data.agents.find(a => a.id === id)?.name || id;
  async function simulate() {
    if (request.current || !message.trim() || !source) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setResult(null); setError('');
    try {
      const value = await api<Result | Chain>(`/studio/${data.client.id}/handoffs/${chain ? 'simulate-chain' : 'simulate'}`, { method: 'POST', signal: controller.signal,
        body: JSON.stringify({ source_agent_id: source, expected_revision: revision, message, language: lang }) });
      if (!controller.signal.aborted) setResult(value);
    } catch (err) { if (!controller.signal.aborted) setError(messageFrom(err)); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  return <section className={styles.preview} data-routing-simulation>
    <h3>{es ? 'Simular derivaciones con IA' : 'Simulate AI handoffs'}</h3>
    {!chain && <p>{es ? 'Evalúa un mensaje con el modelo del agente de origen. Consume tokens: una evaluación por prueba, sin herramientas, historial real ni envíos. No recorre toda la cadena ni activa agentes.' : 'Evaluate a message with the source agent model. Uses tokens: one evaluation per test, without tools, real history or sends. Does not traverse the full chain or activate agents.'}</p>}
    {chain && <p>{es ? `Simula hasta ${maxHops} pasos con el mismo mensaje original y el modelo de cada agente. Puede consumir tokens en cada paso. Sin herramientas, respuestas de agentes, historial real ni envíos.` : `Simulate up to ${maxHops} steps using the same original message and each agent model. Each step may consume tokens. No tools, agent replies, real history or sends.`}</p>}
    <form className={styles.form} onSubmit={event => { event.preventDefault(); void simulate(); }}>
      <fieldset disabled={busy} className={styles.handoffFields}>
        <label>{es ? 'Modo de simulación' : 'Simulation mode'}<select value={chain ? 'chain' : 'single'} onChange={e => { setChain(e.target.value === 'chain'); setResult(null); setError(''); }}>
          <option value="single">{es ? 'Un paso' : 'One step'}</option><option value="chain">{es ? 'Cadena completa' : 'Full chain'}</option>
        </select></label>
        <label>{es ? 'Agente de origen' : 'Source agent'}<select required value={source} onChange={e => { setSource(e.target.value); setResult(null); }}>
          <option value="">{es ? 'Elige un agente' : 'Choose an agent'}</option>{data.agents.filter(a => a.is_active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
        <label>{es ? 'Mensaje de prueba' : 'Test message'}<Textarea required maxLength={4000} value={message} onChange={e => { setMessage(e.target.value); setResult(null); }} /></label>
        <Button type="submit" disabled={!source || !message.trim()}>{busy ? (es ? 'Evaluando…' : 'Evaluating…') : (es ? 'Simular · consume tokens' : 'Simulate · uses tokens')}</Button>
      </fieldset>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status" className={styles.handoffPath}>
      <p>{es ? 'Propuesta simulada, no aplicada' : 'Simulated proposal, not applied'} · {es ? 'Versión' : 'Revision'} {result.revision}</p>
      {('steps' in result ? result.steps : [result]).map((step, index) => <div key={index} data-simulation-step>
      <p>{index + 1}. {name(step.source_agent_id)} → {name(step.target_agent_id)}</p>
      {step.condition && <p>{es ? 'Condición seleccionada' : 'Selected condition'}: {step.condition}</p>}
      {step.reason && <p>{es ? 'Explicación del modelo' : 'Model explanation'}: {step.reason}</p>}
      {step.outcome !== 'matched' && <p>{step.outcome === 'invalid_response' ? (es ? 'Respuesta del modelo no válida; se propone atención humana por seguridad.' : 'Invalid model response; human attention proposed for safety.') : step.outcome === 'no_rules' ? (es ? 'Sin reglas de salida; no se llamó al modelo.' : 'No outgoing rules; model was not called.') : (es ? 'No hay una coincidencia clara; se propone atención humana.' : 'No clear match; human attention proposed.')}</p>}
      </div>)}
      {'steps' in result && <p>{result.outcome === 'hop_limit' || result.outcome === 'cycle_guard' ? (es ? 'Límite de recorrido alcanzado: se propone atención humana, sin evaluar más agentes.' : 'Traversal limit reached: human attention proposed without evaluating more agents.') : (es ? 'Recorrido finalizado en atención humana.' : 'Walkthrough ended at human attention.')}</p>}
    </div>}
  </section>;
}

"use client";
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, messageFrom } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/lib/i18n';
import { channelNames, channelSetupPath, type ChannelKind, type StudioAgent, type StudioGraph } from './types';
import { channelStatus } from './graph';
import { studioCopy } from './copy';
import styles from './studio.module.css';

export type StudioWrite = (path: string, method: string, body: object) => Promise<void>;
export function StudioInspector({ data, selected, write, connect, busy }: {
  data: StudioGraph; selected: string; write: StudioWrite; busy: boolean;
  connect: (kind: ChannelKind, agentId: string) => void;
}) {
  const { lang } = useLanguage(), es = lang === 'es';
  const t = studioCopy[lang];
  const agent = data.agents.find(a => selected === `agent:${a.id}` || selected === `widget:${a.id}`);
  const channel = data.channels.find(c => selected === `channel:${c.kind}`);
  const [target, setTarget] = useState(channel?.agent_id || '');
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [instructions, setInstructions] = useState(agent?.instructions || '');
  const [greeting, setGreeting] = useState(agent?.widget_greeting || '');
  const [color, setColor] = useState(agent?.widget_color || '#5135ff');
  const [enabled, setEnabled] = useState(agent?.widget_enabled || false);
  const creating = selected === 'new';
  const dirty = creating ? Boolean(name || description || instructions) : agent ?
    name !== agent.name || description !== (agent.description || '') || instructions !== (agent.instructions || '') ||
    greeting !== (agent.widget_greeting || '') || color !== (agent.widget_color || '#5135ff') || enabled !== (agent.widget_enabled || false) :
    Boolean(channel && target !== (channel.agent_id || ''));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (creating) await write('/agents', 'POST', { client_id: data.client.id, name, description, instructions });
    else if (agent) await write(`/studio/${data.client.id}/agents/${agent.id}`, 'PATCH', {
      expected_updated_at: agent.updated_at, name, description, instructions,
      widget_greeting: greeting, widget_color: color, widget_enabled: enabled,
    });
  }
  return <aside className={styles.panel} aria-label={t.selected} data-studio-inspector data-studio-dirty={dirty} data-studio-busy={busy} tabIndex={-1}>
    <h2>{creating ? t.add : agent?.name || (channel ? channelNames[channel.kind] : t.choose)}</h2>
    {agent && <Button className="mb-4" variant="outline" render={<a href="#studio-preview" />}>{es ? 'Ir a probar agente' : 'Go to agent test'}</Button>}
    {channel && <div className={styles.form}>
      <p>{channelStatus(channel, t)}</p>
      <label>{t.assigned}<select aria-label={t.assigned} value={target} onChange={e => setTarget(e.target.value)} disabled={busy}>
        <option value="">{t.none}</option>{data.agents.map(a => <option key={a.id} value={a.id} disabled={!a.is_active}>{a.name}</option>)}
      </select></label>
      <Button disabled={busy || !channel.id || !target || target === channel.agent_id || !data.client.is_active} onClick={() => connect(channel.kind, target)}>{es ? 'Aplicar conexión' : 'Apply connection'}</Button>
      <p>{es ? 'También puedes arrastrar el canal hacia un agente. Se pedirá confirmación antes de cambiar la conexión real.' : 'You can also drag the channel onto an agent. Confirmation is required before changing the real connection.'}</p>
      <Button variant="outline" render={<Link href={channelSetupPath(data.client.id, channel.kind)} />}>{es ? 'Credenciales y conexión del canal' : 'Channel credentials and connection'}</Button>
    </div>}
    {(agent || creating) && <form onSubmit={save} className={styles.form}>
      <fieldset disabled={busy} className={styles.form}>
        <label>{es ? 'Nombre' : 'Name'}<Input required maxLength={180} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>{es ? 'Descripción' : 'Description'}<Input maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label>{es ? 'Instrucciones' : 'Instructions'}<Textarea maxLength={32000} value={instructions} onChange={e => setInstructions(e.target.value)} /></label>
        {agent && <>
          <label>{es ? 'Saludo del chat web' : 'Web chat greeting'}<Input maxLength={2000} value={greeting} onChange={e => setGreeting(e.target.value)} /></label>
          <label>{es ? 'Color' : 'Color'}<input type="color" value={color} onChange={e => setColor(e.target.value)} /></label>
          <label className={styles.check}><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />{es ? 'Activar chat web' : 'Enable web chat'}</label>
          <p>{es ? 'Opcional: el chat web aparece en el canvas sólo al activarlo y guardar. No es necesario para probar el agente ni usar otros canales.' : 'Optional: web chat appears on the canvas only after enabling and saving it. It is not required to test the agent or use other channels.'}</p>
          <div className={styles.widget} aria-label={es ? 'Vista previa visual' : 'Visual preview'}>
            <strong style={{ borderColor: color }}>{name}</strong><p>{greeting || (es ? '¡Hola! ¿En qué te ayudo?' : 'Hello! How can I help?')}</p>
            <small>{es ? 'Vista visual del borrador · no envía mensajes' : 'Draft appearance · no messages sent'}</small>
          </div>
        </>}
        <Button type="submit" disabled={!name.trim()}>{busy ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Revisar y guardar' : 'Review and save')}</Button>
      </fieldset>
      {agent && <Button variant="outline" render={<Link href={`/agents/${agent.id}`} />}>{es ? 'Modelo, documentos y herramientas' : 'Model, documents and tools'}</Button>}
    </form>}
    {agent && <PreviewChat key={agent.id + agent.updated_at} clientId={data.client.id} agent={agent} />}
  </aside>;
}
function PreviewChat({ clientId, agent }: { clientId: string; agent: StudioAgent }) {
  const { lang } = useLanguage(), es = lang === 'es';
  const [turns, setTurns] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (request.current || !message.trim()) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await api<{ text: string }>(`/studio/${clientId}/agents/${agent.id}/preview`, {
        method: 'POST', signal: controller.signal, body: JSON.stringify({ message, history: turns.slice(-12) }),
      });
      if (!controller.signal.aborted) { setTurns([...turns, { role: 'user', content: message }, { role: 'assistant', content: result.text }]); setMessage(''); }
    } catch (err) { if (!controller.signal.aborted) setError(messageFrom(err)); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  return <section className={styles.preview} id="studio-preview" data-studio-busy={busy}>
    <h2>{es ? 'Probar agente' : 'Test agent'}</h2>
    <p>{es ? 'Usa la configuración guardada. Consume tokens del proveedor; no ejecuta herramientas ni envía a canales. El chat se pierde al salir.' : 'Uses saved settings. Provider tokens are billed; no tools or channel sends. This chat is cleared when you leave.'}</p>
    <div role="log" className={styles.transcript}>{turns.map((turn, index) => <p key={index}><strong>{turn.role === 'user' ? (es ? 'Tú' : 'You') : agent.name}</strong><br />{turn.content}</p>)}</div>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={send} className={styles.form}>
      <label>{es ? 'Mensaje de prueba' : 'Test message'}<Textarea required maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} disabled={busy} /></label>
      <Button type="submit" disabled={busy || !message.trim() || !agent.model}>{busy ? (es ? 'Probando…' : 'Testing…') : (es ? 'Enviar prueba' : 'Send test')}</Button>
      {!agent.model && <p>{es ? 'Configura primero un modelo y su proveedor.' : 'Configure a model and its provider first.'}</p>}
    </form>
  </section>;
}

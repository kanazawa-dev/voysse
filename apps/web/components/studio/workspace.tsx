"use client";
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ConnectionGraph } from '@/components/studio/graph';
import { studioCopy } from '@/components/studio/copy';
import { type StudioGraph, type ChannelKind } from '@/components/studio/types';
import { ExecutionPanel } from '@/components/studio/execution';
import { HandoffEditor } from '@/components/studio/handoffs';
import { StudioInspector } from '@/components/studio/inspector';
import { ImmersiveStudio } from '@/components/studio/immersive';
import { ClientPicker } from '@/components/studio/client-picker';
import styles from '@/components/studio/studio.module.css';

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  return <ClientStudio key={id} id={id} />;
}
function ClientStudio({ id }: { id: string }) {
  const immersive = usePathname().startsWith('/studio/');
  const [panel, setPanel] = useState('');
  const { lang } = useLanguage();
  const t = studioCopy[lang];
  const [data, setData] = useState<StudioGraph | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const loadVersion = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const version = ++loadVersion.current;
    api<StudioGraph>(`/studio/${id}`, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted && version === loadVersion.current) { setData(value); setError(''); }
    }).catch(err => { if (!controller.signal.aborted && version === loadVersion.current) setError(messageFrom(err)); });
    return () => controller.abort();
  }, [id, revision]);
  useEffect(() => {
    if (!immersive && selected && window.innerWidth < 1200) {
      const panel = document.querySelector<HTMLElement>('[data-studio-inspector]');
      panel?.focus({ preventScroll: true });
      panel?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [selected, immersive]);
  async function write(path: string, method: string, body: object, summary = '') {
    if (writing.current || !window.confirm(summary + '\n\n' + (lang === 'es' ? '¿Aplicar este cambio? Puede afectar canales activos. Las pruebas usan solo la configuración guardada.' : 'Apply this change? Active channels may be affected. Tests use saved settings only.'))) return;
    writing.current = true; loadVersion.current++; setBusy(true); setError('');
    try {
      const result = await api<{ id?: string }>(path, { method, body: JSON.stringify(body) });
      setData(await api<StudioGraph>(`/studio/${id}`));
      if (path === '/agents' && result.id) setSelected(`agent:${result.id}`);
      else if (selected.startsWith('widget:')) setSelected(selected.replace('widget:', 'agent:'));
    } catch (err) { setError(messageFrom(err) + (lang === 'es' ? ' Actualiza antes de intentar otra vez.' : ' Refresh before trying again.')); }
    finally { writing.current = false; setBusy(false); }
  }
  function connect(kind: ChannelKind, agentId: string) {
    const channel = data?.channels.find(c => c.kind === kind);
    if (!channel?.id || channel.agent_id === agentId || !data?.client.is_active || !data.agents.some(a => a.id === agentId && a.is_active)) return;
    void write(`/studio/${id}/channels/${kind}/agent`, 'PUT', { agent_id: agentId, expected_agent_id: channel.agent_id, expected_updated_at: channel.updated_at }, `${kind}: ${data.agents.find(a => a.id === channel.agent_id)?.name || '—'} → ${data.agents.find(a => a.id === agentId)?.name}`);
  }
  const version = data?.agents.find(a => selected.endsWith(':' + a.id))?.updated_at || data?.channels.find(c => selected === 'channel:' + c.kind)?.updated_at || '';
  if (immersive) return <ImmersiveStudio id={id} name={data?.client.name || ''} panel={panel} setPanel={setPanel}
    actions={<><Button variant="outline" disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw />{t.refresh}</Button><Button disabled={busy} onClick={() => { setSelected('new'); setPanel('inspector'); }}><Plus />{t.add}</Button></>}
    graph={data ? <ConnectionGraph immersive data={data} selected={selected} onSelect={value => { if (!busy) { setSelected(value); setPanel('inspector'); } }} onConnect={connect} t={t} /> : <p role="status">{error || t.loading}</p>}
    inspector={data && <StudioInspector key={selected + version} data={data} selected={selected} write={write} connect={connect} busy={busy} />}
    handoffs={data && <HandoffEditor data={data} />} execution={data && <ExecutionPanel data={data} />} error={error} busy={busy} />;
  return <div className={styles.workspace} data-studio-workspace data-studio-busy={busy}>
    <ClientPicker current={id} />
    <Link href={`/clients/${id}`} className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />{t.back}</Link>
    <header className={styles.header}><div><small>{data?.client.name}</small><h1>{t.title}</h1><p>{t.intro}</p></div>
      <div className={styles.actions}><Button variant="outline" disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw />{t.refresh}</Button>
        <Button disabled={busy} onClick={() => setSelected('new')}><Plus />{t.add}</Button></div></header>
    {error && <p role="alert">{error}</p>}
    {!data ? <p role="status">{error ? '' : t.loading}</p> : <>
      {!data.agents.length && <p>{t.empty}</p>}
      <div className={styles.editor}>
        <ConnectionGraph data={data} selected={selected} onSelect={value => { if (!busy) setSelected(value); }} onConnect={connect} t={t} />
        <StudioInspector key={selected + version} data={data} selected={selected} write={write} connect={connect} busy={busy} />
      </div>
      <HandoffEditor data={data} />
      <ExecutionPanel data={data} />
    </>}
  </div>;
}

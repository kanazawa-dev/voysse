"use client";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ConnectionGraph } from '@/components/studio/graph';
import { studioCopy } from '@/components/studio/copy';
import { channelNames, channelSetupPath, type StudioGraph, type ChannelKind } from '@/components/studio/types';
import styles from '@/components/studio/studio.module.css';

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  return <ClientStudio key={id} id={id} />;
}
function ClientStudio({ id }: { id: string }) {
  const { lang } = useLanguage();
  const t = studioCopy[lang];
  const [data, setData] = useState<StudioGraph | null>(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<StudioGraph>(`/studio/${id}`, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) { setData(value); setError(''); }
    }).catch(err => { if (!controller.signal.aborted) setError(messageFrom(err)); });
    return () => controller.abort();
  }, [id, revision]);
  const agent = data?.agents.find(a => selected === `agent:${a.id}` || selected === `widget:${a.id}`);
  const channel = data?.channels.find(c => selected === `channel:${c.kind}`);
  return <div className={styles.workspace}>
    <Link href={`/clients/${id}`} className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />{t.back}</Link>
    <header className={styles.header}><div><small>{data?.client.name}</small><h1>{t.title}</h1><p>{t.intro}</p></div>
      <div className={styles.actions}><Button variant="outline" onClick={() => setRevision(v => v + 1)}><RefreshCw />{t.refresh}</Button>
        <Button render={<Link href={`/agents/new?client=${id}`} />}><Plus />{t.add}</Button></div></header>
    {error && <p role="alert">{error}</p>}
    {!data ? <p role="status">{error ? '' : t.loading}</p> : <>
      {!data.agents.length && <p>{t.empty}</p>}
      <ConnectionGraph data={data} selected={selected} onSelect={setSelected} t={t} />
      <aside className={styles.panel} aria-label={t.selected}>
        <h2>{agent?.name || (channel ? channelNames[channel.kind as ChannelKind] : t.choose)}</h2>
        <p>{agent?.description || (channel ? `${t.assigned}: ${data.agents.find(a => a.id === channel.agent_id)?.name || t.none}` : t.intro)}</p>
        {(agent || channel) && <Button className="mt-4" variant="outline" render={<Link href={agent ? `/agents/${agent.id}` : channelSetupPath(id, channel!.kind)} />}>{t.configure}</Button>}
      </aside>
    </>}
  </div>;
}

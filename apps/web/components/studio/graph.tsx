"use client";
import { useState } from 'react';
import { Bot, Globe2, Radio, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudioCopy } from './copy';
import { channelNames, type ChannelKind, type StudioChannel, type StudioGraph } from './types';
import styles from './studio.module.css';

export function channelStatus(channel: StudioChannel, t: StudioCopy) {
  if (!channel.id) return t.missing;
  if (!channel.is_enabled) return t.disabled;
  if (channel.status === 'connected') return t.ready;
  if (channel.status === 'error') return t.error;
  if (channel.status === 'disconnected') return t.disconnected;
  return t.waiting;
}

export function ConnectionGraph({ data, selected, onSelect, onConnect, t }: {
  data: StudioGraph; selected: string; onSelect: (id: string) => void; t: StudioCopy;
  onConnect?: (kind: ChannelKind, agentId: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const height = Math.max(4, data.agents.length) * 112 + 100;
  const y = (index: number) => 70 + index * 112;
  const node = (id: string, x: number, index: number, title: string, subtitle: string,
                icon: React.ReactNode, kind?: ChannelKind, agentId?: string) => (
    <button key={id} type="button" data-studio-node={id} className={styles.node}
      style={{ left: x, top: y(index) }} aria-pressed={selected === id} onClick={() => onSelect(id)}
      draggable={!!kind && !!onConnect && !!data.channels.find(c => c.kind === kind)?.id}
      onDragStart={event => { if (kind) event.dataTransfer.setData('application/x-voysse-channel', kind); }}
      onDragOver={event => { if (agentId && onConnect) event.preventDefault(); }}
      onDrop={event => {
        event.preventDefault();
        const source = event.dataTransfer.getData('application/x-voysse-channel') as ChannelKind;
        if (agentId && data.channels.some(c => c.kind === source)) onConnect?.(source, agentId);
      }}>
      <span className={styles.nodeIcon}>{icon}</span><strong title={title}>{title}</strong>
      <small title={subtitle}>{subtitle}</small>
    </button>
  );
  return <section className={styles.graph} aria-label={t.title}>
    <div className={styles.toolbar}><p>{t.hint}</p><div className={styles.zoom}>
      <Button variant="ghost" size="icon" aria-label={t.zoomOut} disabled={zoom <= .75} onClick={() => setZoom(zoom - .25)}><ZoomOut /></Button>
      <span>{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="icon" aria-label={t.zoomIn} disabled={zoom >= 1.5} onClick={() => setZoom(zoom + .25)}><ZoomIn /></Button>
    </div></div>
    <div className={styles.viewport} tabIndex={0} aria-label={t.hint}>
      <div className={styles.extent} style={{ width: 936 * zoom, height: height * zoom }}>
        <div className={styles.map} style={{ height, transform: `scale(${zoom})` }}>
          <div className={styles.headings}><span>{t.channels}</span><span>{t.agents}</span><span>{t.widgets}</span></div>
          <svg className={styles.edges} width="936" height={height} aria-hidden="true">
            {data.channels.map((channel, index) => {
              const target = data.agents.findIndex(a => a.id === channel.agent_id);
              return target < 0 ? null : <path key={channel.kind} data-studio-edge={channel.kind}
                strokeDasharray={channel.is_enabled ? undefined : '5 5'}
                d={`M284 ${y(index) + 44} C312 ${y(index) + 44} 312 ${y(target) + 44} 340 ${y(target) + 44}`} />;
            })}
            {data.agents.map((agent, index) => <path key={agent.id} strokeDasharray={agent.widget_enabled ? undefined : '5 5'} d={`M600 ${y(index) + 44} H656`} />)}
          </svg>
          <div className={styles.column} aria-label={t.channels}>{data.channels.map((channel, index) => node(
            `channel:${channel.kind}`, 24, index, channelNames[channel.kind],
            `${channelStatus(channel, t)} · ${data.agents.find(a => a.id === channel.agent_id)?.name || t.none}`, <Radio size={18} />, channel.kind,
          ))}</div>
          <div className={styles.column} aria-label={t.agents}>{data.agents.map((agent, index) => node(
            `agent:${agent.id}`, 340, index, agent.name, agent.is_active ? t.active : t.inactive, <Bot size={18} />, undefined, agent.id,
          ))}</div>
          <div className={styles.column} aria-label={t.widgets}>{data.agents.map((agent, index) => node(
            `widget:${agent.id}`, 656, index, `${t.widgets} · ${agent.name}`, agent.widget_enabled ? t.active : t.disabled, <Globe2 size={18} />,
          ))}</div>
        </div>
      </div>
    </div>
  </section>;
}

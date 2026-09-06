"use client";
import { useCanvasLayout } from './layout';
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
  const layout = useCanvasLayout(data), { zoom, setZoom } = layout;
  const point = (id: string, x: number, index: number) => layout.positions[id] || { x, y: 70 + index * 112 };
  const width = Math.max(936, ...Object.values(layout.positions).map(p => p.x + 280));
  const height = Math.max(Math.max(4, data.agents.length) * 112 + 100, ...Object.values(layout.positions).map(p => p.y + 108));
  const edge = (from: { x: number; y: number }, to: { x: number; y: number }) => `M${from.x + 260} ${from.y + 44} C${from.x + 292} ${from.y + 44} ${to.x - 32} ${to.y + 44} ${to.x} ${to.y + 44}`;
  const node = (id: string, x: number, index: number, title: string, subtitle: string,
                icon: React.ReactNode, kind?: ChannelKind, agentId?: string) => (
    <button key={id} type="button" data-studio-node={id} className={styles.node}
      style={{ left: point(id, x, index).x, top: point(id, x, index).y }} aria-pressed={selected === id} onClick={() => { if (!layout.organize) onSelect(id); }}
      onKeyDown={event => {
        if (!layout.organize || layout.busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); const p = point(id, x, index), step = event.shiftKey ? 50 : 10;
        layout.move(id, p.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), p.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
      }}
      draggable={!layout.busy && (layout.organize || (!!kind && !!onConnect && !!data.channels.find(c => c.kind === kind)?.id))}
      onDragStart={event => {
        if (layout.organize) { const r = event.currentTarget.getBoundingClientRect(); event.dataTransfer.setData('application/x-voysse-layout', JSON.stringify({ id, dx: (event.clientX - r.left) / zoom, dy: (event.clientY - r.top) / zoom })); }
        else if (kind) event.dataTransfer.setData('application/x-voysse-channel', kind);
      }}
      onDragOver={event => { if (!layout.organize && agentId && onConnect) event.preventDefault(); }}
      onDrop={event => {
        if (layout.organize) return;
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
    {layout.controls}
    <div className={styles.viewport} tabIndex={0} aria-label={t.hint}>
      <div className={styles.extent} style={{ width: width * zoom, height: height * zoom }}>
        <div className={styles.map} style={{ width, height, transform: `scale(${zoom})` }}
          onDragOver={event => { if (layout.organize) event.preventDefault(); }}
          onDrop={event => {
            if (!layout.organize || layout.busy) return;
            event.preventDefault();
            try { const p = JSON.parse(event.dataTransfer.getData('application/x-voysse-layout')); const r = event.currentTarget.getBoundingClientRect();
              layout.move(p.id, (event.clientX - r.left) / zoom - p.dx, (event.clientY - r.top) / zoom - p.dy);
            } catch { /* Ignore unrelated drag data. */ }
          }}>
          <div className={styles.headings}><span>{t.channels}</span><span>{t.agents}</span><span>{t.widgets}</span></div>
          <svg className={styles.edges} width={width} height={height} aria-hidden="true">
            {data.channels.map((channel, index) => {
              const target = data.agents.findIndex(a => a.id === channel.agent_id);
              return target < 0 ? null : <path key={channel.kind} data-studio-edge={channel.kind}
                strokeDasharray={channel.is_enabled ? undefined : '5 5'}
                d={edge(point(`channel:${channel.kind}`, 24, index), point(`agent:${data.agents[target].id}`, 340, target))} />;
            })}
            {data.agents.map((agent, index) => <path key={agent.id} strokeDasharray={agent.widget_enabled ? undefined : '5 5'} d={edge(point(`agent:${agent.id}`, 340, index), point(`widget:${agent.id}`, 656, index))} />)}
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

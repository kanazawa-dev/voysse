"use client";
import { useId, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useCanvasLayout } from './layout';
import { Bot, Globe2, Radio, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Rule } from './handoffs';
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

export function ConnectionGraph({ data, selected, onSelect, onConnect, onAgentConnect, rules = [], onRuleSelect, t, immersive = false }: {
  immersive?: boolean;
  data: StudioGraph; selected: string; onSelect: (id: string) => void; t: StudioCopy;
  onConnect?: (kind: ChannelKind, agentId: string) => void;
  onAgentConnect?: (source: string, target: string) => void;
  rules?: Rule[]; onRuleSelect?: (index: number) => void;
}) {
  const { lang } = useLanguage();
  const es = lang === 'es', arrow = useId();
  const [connecting, setConnecting] = useState(false), [source, setSource] = useState('');
  const hint = immersive ? (lang === 'es' ? 'Arrastra el fondo para moverte. Selecciona un nodo para configurarlo.' : 'Drag the background to pan. Select a node to configure it.') : t.hint;
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const layout = useCanvasLayout(data), { zoom, setZoom } = layout;
  const point = (id: string, x: number, index: number) => layout.positions[id] || { x, y: 70 + index * 112 };
  const widgets = data.agents.flatMap((agent, index) => agent.widget_enabled ? [{ agent, index }] : []);
  // Keep hidden widget positions saved, but exclude them from the visible canvas bounds.
  const visible = new Set([...data.channels.map(c => `channel:${c.kind}`), ...data.agents.map(a => `agent:${a.id}`), ...widgets.map(({ agent }) => `widget:${agent.id}`)]);
  const visiblePositions = Object.entries(layout.positions).filter(([id]) => visible.has(id)).map(([, position]) => position);
  const hasHandoffs = rules.some(r => r.target_agent_id !== null);
  const width = Math.max(widgets.length ? 936 : hasHandoffs ? 700 : 620, ...visiblePositions.map(p => p.x + (hasHandoffs ? 360 : 280)));
  const height = Math.max(Math.max(4, data.agents.length) * 112 + 100, ...visiblePositions.map(p => p.y + 108));
  const edge = (from: { x: number; y: number }, to: { x: number; y: number }) => `M${from.x + 260} ${from.y + 44} C${from.x + 292} ${from.y + 44} ${to.x - 32} ${to.y + 44} ${to.x} ${to.y + 44}`;
  const node = (id: string, x: number, index: number, title: string, subtitle: string,
                icon: React.ReactNode, kind?: ChannelKind, agentId?: string) => (
    <button key={id} type="button" data-studio-node={id} className={styles.node}
      style={{ left: point(id, x, index).x, top: point(id, x, index).y, '--node-x': `${point(id, x, index).x}px`, '--node-y': `${point(id, x, index).y}px` } as React.CSSProperties} aria-pressed={connecting && !layout.organize ? source === id : selected === id} onClick={() => {
        if (layout.organize) return;
        if (connecting) {
          if (!source && (agentId || (kind && data.channels.find(c => c.kind === kind)?.id))) setSource(id);
          else if (source && agentId) {
            if (source.startsWith('agent:')) onAgentConnect?.(source.slice(6), agentId);
            else if (source.startsWith('channel:')) onConnect?.(source.slice(8) as ChannelKind, agentId);
            setSource('');
          }
        } else onSelect(id);
      }}
      onKeyDown={event => {
        if (!layout.organize || layout.busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); const p = point(id, x, index), step = event.shiftKey ? 50 : 10;
        layout.move(id, p.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), p.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
      }}
      draggable={!layout.busy && (layout.organize || (connecting && !!agentId) || (!!kind && !!onConnect && !!data.channels.find(c => c.kind === kind)?.id))}
      onDragStart={event => {
        if (layout.organize) { const r = event.currentTarget.getBoundingClientRect(); event.dataTransfer.setData('application/x-voysse-layout', JSON.stringify({ id, dx: (event.clientX - r.left) / zoom, dy: (event.clientY - r.top) / zoom })); }
        else if (connecting && agentId) { setSource(id); event.dataTransfer.setData('application/x-voysse-agent', agentId); }
        else if (kind) event.dataTransfer.setData('application/x-voysse-channel', kind);
      }}
      onDragOver={event => { if (!layout.organize && agentId && onConnect) event.preventDefault(); }}
      onDrop={event => {
        if (layout.organize) return;
        event.preventDefault();
        const fromAgent = event.dataTransfer.getData('application/x-voysse-agent');
        if (connecting && agentId && fromAgent) { onAgentConnect?.(fromAgent, agentId); setSource(''); return; }
        const source = event.dataTransfer.getData('application/x-voysse-channel') as ChannelKind;
        if (agentId && data.channels.some(c => c.kind === source)) onConnect?.(source, agentId);
      }}>
      <span className={styles.nodeIcon}>{icon}</span><strong title={title}>{title}</strong>
      <small title={subtitle}>{subtitle}</small>
    </button>
  );
  return <section className={styles.graph} aria-label={t.title} onKeyDown={e => { if (e.key === 'Escape') { setConnecting(false); setSource(''); } }}>
    <div className={styles.toolbar}><p>{hint}</p><div className={styles.zoom}>
      <Button variant="ghost" size="icon" aria-label={t.zoomOut} disabled={zoom <= .75} onClick={() => setZoom(zoom - .25)}><ZoomOut /></Button>
      <span>{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="icon" aria-label={t.zoomIn} disabled={zoom >= 1.5} onClick={() => setZoom(zoom + .25)}><ZoomIn /></Button>
    </div></div>
    {onAgentConnect && <div className={styles.connectionTools}>
      <Button variant={connecting ? 'default' : 'outline'} disabled={layout.organize || layout.busy || !data.client.is_active} aria-pressed={connecting} onClick={() => { setConnecting(!connecting); setSource(''); }}>{connecting ? (es ? 'Cancelar conexión' : 'Cancel connection') : (es ? 'Conectar nodos' : 'Connect nodes')}</Button>
      <p role="status">{connecting && !layout.organize ? (source ? (es ? 'Elige el agente de destino. Escape cancela.' : 'Choose the target agent. Escape cancels.') : (es ? 'Selecciona origen y destino, o arrastra un agente hacia otro.' : 'Select source and target, or drag an agent onto another.')) : (es ? 'Agentes: borrador con condición. Canales: cambio real con confirmación.' : 'Agents: conditional draft. Channels: confirmed live binding.')}</p>
    </div>}
    {immersive ? <details className={styles.canvasSettings}><summary>{lang === 'es' ? 'Vista y distribución' : 'View & layout'} · {Math.round(zoom * 100)}%</summary>{layout.controls}</details> : layout.controls}
    <div className={styles.viewport} tabIndex={0} aria-label={hint}
      onPointerDown={e => { if (!immersive || e.button !== 0 || (e.target as HTMLElement).closest('button, [role="button"]')) return; pan.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (pan.current) { e.currentTarget.scrollLeft = pan.current.left + pan.current.x - e.clientX; e.currentTarget.scrollTop = pan.current.top + pan.current.y - e.clientY; } }}
      onPointerUp={() => { pan.current = null; }} onPointerCancel={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}>
      <div className={styles.extent} style={{ width: width * zoom, height: height * zoom, '--canvas-width': `${width * zoom}px`, '--canvas-height': `${height * zoom}px` } as React.CSSProperties}>
        <div className={styles.map} style={{ width, height, transform: `scale(${zoom})`, '--map-width': `${width}px`, '--map-height': `${height}px`, '--map-zoom': zoom } as React.CSSProperties}
          onDragOver={event => { if (layout.organize) event.preventDefault(); }}
          onDrop={event => {
            if (!layout.organize || layout.busy) return;
            event.preventDefault();
            try { const p = JSON.parse(event.dataTransfer.getData('application/x-voysse-layout')); const r = event.currentTarget.getBoundingClientRect();
              layout.move(p.id, (event.clientX - r.left) / zoom - p.dx, (event.clientY - r.top) / zoom - p.dy);
            } catch { /* Ignore unrelated drag data. */ }
          }}>
          <svg className={styles.edges} width={width} height={height}>
            <defs><marker id={arrow} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="currentColor" stroke="none" /></marker></defs>
            {data.channels.map((channel, index) => {
              const target = data.agents.findIndex(a => a.id === channel.agent_id);
              return target < 0 ? null : <path key={channel.kind} data-studio-edge={channel.kind}
                strokeDasharray={channel.is_enabled ? undefined : '5 5'}
                d={edge(point(`channel:${channel.kind}`, 24, index), point(`agent:${data.agents[target].id}`, 340, target))} />;
            })}
            {rules.map((rule, index) => {
              const a = data.agents.findIndex(a => a.id === rule.source_agent_id), b = data.agents.findIndex(a => a.id === rule.target_agent_id);
              if (a < 0 || b < 0) return null;
              const from = point(`agent:${rule.source_agent_id}`, 340, a), to = point(`agent:${rule.target_agent_id}`, 340, b);
              const bend = Math.max(from.x, to.x) + 320;
              const label = `${data.agents[a].name} → ${data.agents[b].name} · ${es ? 'Borrador' : 'Draft'}: ${rule.condition || (es ? 'Falta condición' : 'Condition required')}`;
              return <path key={index} className={styles.handoffEdge} data-studio-handoff-edge={index} role="button" tabIndex={0} aria-label={label} markerEnd={`url(#${arrow})`} strokeDasharray="6 4"
                onClick={() => onRuleSelect?.(index)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRuleSelect?.(index); } }}
                d={`M${from.x + 260} ${from.y + 44} C${bend} ${from.y + 44} ${bend} ${to.y + 44} ${to.x + 260} ${to.y + 44}`}><title>{label}</title></path>;
            })}
            {widgets.map(({ agent, index }) => <path key={agent.id} data-studio-widget-edge={agent.id} d={edge(point(`agent:${agent.id}`, 340, index), point(`widget:${agent.id}`, 656, index))} />)}
          </svg>
          <div className={styles.column} aria-label={t.channels}>{data.channels.map((channel, index) => node(
            `channel:${channel.kind}`, 24, index, channelNames[channel.kind],
            `${channelStatus(channel, t)} · ${data.agents.find(a => a.id === channel.agent_id)?.name || t.none}`, <Radio size={18} />, channel.kind,
          ))}</div>
          <div className={styles.column} aria-label={t.agents}>{data.agents.map((agent, index) => node(
            `agent:${agent.id}`, 340, index, agent.name, agent.is_active ? t.active : t.inactive, <Bot size={18} />, undefined, agent.id,
          ))}</div>
          <div className={styles.column} aria-label={t.widgets}>{widgets.map(({ agent, index }) => node(
            `widget:${agent.id}`, 656, index, `${t.widgets} · ${agent.name}`, agent.widget_enabled ? t.active : t.disabled, <Globe2 size={18} />,
          ))}</div>
        </div>
      </div>
    </div>
  </section>;
}

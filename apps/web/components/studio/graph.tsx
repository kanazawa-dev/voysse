"use client";
import { useEffect, useId, useRef, useState } from 'react';
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

// A node can be dragged by its body (reposition) or from its small connector
// handle (draw a link to another node). Both are plain pointer-capture drags
// so movement always looks and feels the same, with no separate mode to toggle.
type Drag = { kind: 'move'; id: string; dx: number; dy: number } | { kind: 'link'; from: string; x: number; y: number };

export function ConnectionGraph({ data, selected, onSelect, onConnect, onAgentConnect, rules = [], onRuleSelect, t, immersive = false }: {
  immersive?: boolean;
  data: StudioGraph; selected: string; onSelect: (id: string) => void; t: StudioCopy;
  onConnect?: (kind: ChannelKind, agentId: string) => void;
  onAgentConnect?: (source: string, target: string) => void;
  rules?: Rule[]; onRuleSelect?: (index: number) => void;
}) {
  const { lang } = useLanguage();
  const es = lang === 'es', arrow = useId();
  const [drag, setDrag] = useState<Drag | null>(null);
  // Below 641px the canvas becomes a stacked card list (no absolute positions to
  // drag between); only the connector handles stay active there for connecting.
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 641px)'), sync = () => setDesktop(media.matches);
    sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
  }, []);
  const map = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const layout = useCanvasLayout(data), { zoom } = layout;
  const point = (id: string, x: number, index: number) => layout.positions[id] || { x, y: 70 + index * 112 };
  const widgets = data.agents.flatMap((agent, index) => agent.widget_enabled ? [{ agent, index }] : []);
  // Keep hidden widget positions saved, but exclude them from the visible canvas bounds.
  const visible = new Set([...data.channels.map(c => `channel:${c.kind}`), ...data.agents.map(a => `agent:${a.id}`), ...widgets.map(({ agent }) => `widget:${agent.id}`)]);
  const visiblePositions = Object.entries(layout.positions).filter(([id]) => visible.has(id)).map(([, position]) => position);
  const hasHandoffs = rules.some(r => r.target_agent_id !== null);
  const width = Math.max(widgets.length ? 936 : hasHandoffs ? 700 : 620, ...visiblePositions.map(p => p.x + (hasHandoffs ? 360 : 280)));
  const height = Math.max(Math.max(4, data.agents.length) * 112 + 100, ...visiblePositions.map(p => p.y + 108));
  const edge = (from: { x: number; y: number }, to: { x: number; y: number }) => `M${from.x + 260} ${from.y + 44} C${from.x + 292} ${from.y + 44} ${to.x - 32} ${to.y + 44} ${to.x} ${to.y + 44}`;
  const canLink = (id: string) => id.startsWith('agent:') || (id.startsWith('channel:') && !!onConnect);
  function toMap(clientX: number, clientY: number) {
    const rect = map.current?.getBoundingClientRect();
    return rect ? { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom } : { x: 0, y: 0 };
  }
  function targetAt(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-studio-node]');
    return el?.dataset.studioNode || null;
  }
  function finishLinkTo(from: string, to: string | null) {
    if (!to || to === from) return;
    if (from.startsWith('agent:') && to.startsWith('agent:')) onAgentConnect?.(from.slice(6), to.slice(6));
    else if (from.startsWith('channel:') && to.startsWith('agent:')) onConnect?.(from.slice(8) as ChannelKind, to.slice(6));
  }
  const node = (id: string, x: number, index: number, title: string, subtitle: string, icon: React.ReactNode) => {
    const canDrag = desktop && !layout.busy;
    const p = point(id, x, index);
    const linkable = canLink(id) && !!(onAgentConnect || onConnect);
    return <div key={id} className={styles.nodeWrap} style={{ left: p.x, top: p.y, '--node-x': `${p.x}px`, '--node-y': `${p.y}px` } as React.CSSProperties}>
      <button type="button" data-studio-node={id} className={styles.node}
        aria-pressed={selected === id}
        onClick={() => { if (drag?.kind === 'link') { finishLinkTo(drag.from, id); setDrag(null); } else if (!drag) onSelect(id); }}
        onKeyDown={event => {
          if (drag?.kind === 'link' && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault(); finishLinkTo(drag.from, id); setDrag(null); return;
          }
          if (layout.busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); const here = point(id, x, index), step = event.shiftKey ? 50 : 10;
          layout.move(id, here.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), here.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
        }}
        onPointerDown={event => {
          if (!canDrag || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const here = point(id, x, index), start = toMap(event.clientX, event.clientY);
          setDrag({ kind: 'move', id, dx: start.x - here.x, dy: start.y - here.y });
        }}
        onPointerMove={event => {
          if (drag?.kind !== 'move' || drag.id !== id) return;
          const at = toMap(event.clientX, event.clientY);
          layout.move(id, at.x - drag.dx, at.y - drag.dy);
        }}
        onPointerUp={() => setDrag(null)}
        onLostPointerCapture={() => setDrag(null)}>
        <span className={styles.nodeIcon}>{icon}</span><strong title={title}>{title}</strong>
        <small title={subtitle}>{subtitle}</small>
      </button>
      {linkable && <span data-connector-handle data-studio-node={id} className={styles.connector}
        role="button" tabIndex={0} aria-label={es ? `Conectar desde ${title}` : `Connect from ${title}`}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setDrag({ kind: 'link', from: id, x: p.x + 260, y: p.y + 44 });
        }}
        onPointerDown={event => {
          event.stopPropagation(); event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          const at = toMap(event.clientX, event.clientY);
          setDrag({ kind: 'link', from: id, x: at.x, y: at.y });
        }}
        onPointerMove={event => {
          if (drag?.kind !== 'link') return;
          event.stopPropagation();
          setDrag({ ...drag, ...toMap(event.clientX, event.clientY) });
        }}
        onPointerUp={event => {
          event.stopPropagation();
          if (drag?.kind === 'link') finishLinkTo(drag.from, targetAt(event.clientX, event.clientY));
          setDrag(null);
        }}
        onLostPointerCapture={() => setDrag(null)} />}
    </div>;
  };
  const linking = drag?.kind === 'link';
  return <section className={styles.graph} aria-label={t.title} onKeyDown={e => { if (e.key === 'Escape') setDrag(null); }}>
    <div className={styles.toolbar}>
      <p role="status">{linking ? (es ? 'Suelta sobre un agente para conectar. Escape cancela.' : 'Drop on an agent to connect. Escape cancels.') : (immersive ? (es ? 'Arrastra un nodo para moverlo. Arrastra el punto de conexión hacia otro nodo para enlazarlos.' : 'Drag a node to move it. Drag its connector to another node to link them.') : t.hint)}</p>
      <div className={styles.zoom}>
        <Button variant="ghost" size="icon" aria-label={t.zoomOut} disabled={zoom <= .75} onClick={() => layout.setZoom(zoom - .25)}><ZoomOut /></Button>
        <span>{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" aria-label={t.zoomIn} disabled={zoom >= 1.5} onClick={() => layout.setZoom(zoom + .25)}><ZoomIn /></Button>
      </div>
      {layout.controls}
    </div>
    <div className={styles.viewport} tabIndex={0} aria-label={t.hint}
      onPointerDown={e => { if (!immersive || e.button !== 0 || drag || (e.target as HTMLElement).closest('button, [role="button"]')) return; pan.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (pan.current) { e.currentTarget.scrollLeft = pan.current.left + pan.current.x - e.clientX; e.currentTarget.scrollTop = pan.current.top + pan.current.y - e.clientY; } }}
      onPointerUp={() => { pan.current = null; }} onPointerCancel={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}>
      <div className={styles.extent} style={{ width: width * zoom, height: height * zoom, '--canvas-width': `${width * zoom}px`, '--canvas-height': `${height * zoom}px` } as React.CSSProperties}>
        <div ref={map} className={styles.map} style={{ width, height, transform: `scale(${zoom})`, '--map-width': `${width}px`, '--map-height': `${height}px`, '--map-zoom': zoom } as React.CSSProperties}>
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
            {drag?.kind === 'link' && (() => {
              const from = drag.from.startsWith('agent:')
                ? point(drag.from, 340, data.agents.findIndex(agent => `agent:${agent.id}` === drag.from))
                : point(drag.from, 24, data.channels.findIndex(channel => `channel:${channel.kind}` === drag.from));
              return <path data-studio-link-preview className={styles.linkPreview} d={`M${from.x + 260} ${from.y + 44} L${drag.x} ${drag.y}`} />;
            })()}
          </svg>
          <div className={styles.column} aria-label={t.channels}>{data.channels.map((channel, index) => node(
            `channel:${channel.kind}`, 24, index, channelNames[channel.kind],
            `${channelStatus(channel, t)} · ${data.agents.find(a => a.id === channel.agent_id)?.name || t.none}`, <Radio size={18} />,
          ))}</div>
          <div className={styles.column} aria-label={t.agents}>{data.agents.map((agent, index) => node(
            `agent:${agent.id}`, 340, index, agent.name, agent.is_active ? t.active : t.inactive, <Bot size={18} />,
          ))}</div>
          <div className={styles.column} aria-label={t.widgets}>{widgets.map(({ agent, index }) => node(
            `widget:${agent.id}`, 656, index, `${t.widgets} · ${agent.name}`, agent.widget_enabled ? t.active : t.disabled, <Globe2 size={18} />,
          ))}</div>
        </div>
      </div>
    </div>
  </section>;
}

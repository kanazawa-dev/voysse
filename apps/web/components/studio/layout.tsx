"use client";
import { useEffect, useRef, useState } from 'react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { StudioGraph } from './types';
import styles from './studio.module.css';
export type CanvasLayout = { revision: number; positions: Record<string, { x: number; y: number }>; zoom: number };
export function useCanvasLayout(data: StudioGraph) {
  const { lang } = useLanguage(), es = lang === 'es';
  const [value, setValue] = useState<CanvasLayout>(data.layout || { revision: 0, positions: {}, zoom: 100 });
  const [organize, setOrganize] = useState(false), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const allowed = new Set([...data.channels.map(c => `channel:${c.kind}`), ...data.agents.flatMap(a => [`agent:${a.id}`, `widget:${a.id}`])]);
  const positions = Object.fromEntries(Object.entries(value.positions).filter(([id]) => allowed.has(id)));
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 641px)'), reset = () => setOrganize(false);
    media.addEventListener('change', reset); return () => media.removeEventListener('change', reset);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function edit(next: CanvasLayout) { if (!request.current) { setValue(next); setDirty(true); setError(''); } }
  function move(id: string, x: number, y: number) {
    if (!allowed.has(id) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!positions[id] && Object.keys(positions).length >= 200) { setError(es ? 'Límite de 200 posiciones guardadas.' : 'Limit of 200 saved positions.'); return; }
    edit({ ...value, positions: { ...positions, [id]: { x: Math.max(0, Math.min(4096, Math.round(x))), y: Math.max(70, Math.min(32768, Math.round(y))) } } });
  }
  async function sync(save: boolean) {
    if (request.current || (!save && dirty && !window.confirm(es ? '¿Descartar los cambios de distribución y recargar?' : 'Discard layout changes and reload?'))) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await api<CanvasLayout>(`/studio/${data.client.id}/layout`, { signal: controller.signal, ...(save ? { method: 'PUT', body: JSON.stringify({ expected_revision: value.revision, positions, zoom: value.zoom }) } : {}) });
      if (!controller.signal.aborted) { setValue(result); setDirty(false); }
    } catch (err) { if (!controller.signal.aborted) setError(messageFrom(err) + (es ? ' Tus cambios se conservan; recarga para resolver el conflicto.' : ' Your changes are preserved; reload to resolve conflicts.')); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  return { organize, busy, positions, zoom: value.zoom / 100, move,
    setZoom: (zoom: number) => edit({ ...value, zoom: Math.round(zoom * 100) }),
    controls: <div className={styles.layoutControls} data-layout-controls>
      <Button variant="outline" aria-pressed={organize} disabled={busy} onClick={() => setOrganize(!organize)}>{es ? 'Organizar nodos' : 'Arrange nodes'}</Button>
      <Button disabled={busy || !dirty} onClick={() => void sync(true)}>{es ? 'Guardar distribución' : 'Save layout'}</Button>
      <Button variant="outline" disabled={busy} onClick={() => void sync(false)}>{es ? 'Recargar distribución' : 'Reload layout'}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm(es ? '¿Restaurar posiciones y zoom? Debes guardar para aplicarlo.' : 'Reset positions and zoom? Save to apply.')) edit({ ...value, positions: {}, zoom: 100 }); }}>{es ? 'Restablecer vista' : 'Reset view'}</Button>
      <p role="status">{dirty ? (es ? 'Distribución sin guardar' : 'Unsaved layout') : (es ? 'Distribución guardada' : 'Saved layout')} · {es ? 'Revisión' : 'Revision'} {value.revision}</p>
      {organize && <p>{es ? 'Arrastra cualquier nodo o usa las flechas del teclado (Mayús: paso mayor). En este modo no conectas canales.' : 'Drag any node or use arrow keys (Shift: larger step). This mode does not connect channels.'}</p>}
      {error && <p role="alert">{error}</p>}
    </div>,
  };
}

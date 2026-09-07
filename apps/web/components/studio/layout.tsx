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
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const allowed = new Set([...data.channels.map(c => `channel:${c.kind}`), ...data.agents.flatMap(a => [`agent:${a.id}`, `widget:${a.id}`])]);
  const positions = Object.fromEntries(Object.entries(value.positions).filter(([id]) => allowed.has(id)));
  useEffect(() => () => request.current?.abort(), []);
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
  return { busy, dirty, positions, zoom: value.zoom / 100,
    move, setZoom: (zoom: number) => edit({ ...value, zoom: Math.round(zoom * 100) }),
    controls: <div className={styles.layoutControls} data-layout-controls data-studio-busy={busy} data-studio-dirty={dirty}>
      <Button variant="outline" size="sm" disabled={busy || !dirty} onClick={() => void sync(true)}>{es ? 'Guardar distribución' : 'Save layout'}</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void sync(false)}>{es ? 'Recargar' : 'Reload'}</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => { if (window.confirm(es ? '¿Restaurar posiciones y zoom? Debes guardar para aplicarlo.' : 'Reset positions and zoom? Save to apply.')) edit({ ...value, positions: {}, zoom: 100 }); }}>{es ? 'Restablecer' : 'Reset'}</Button>
      <span role="status">{dirty ? (es ? 'Sin guardar' : 'Unsaved') : (es ? 'Guardado' : 'Saved')} · v{value.revision}</span>
      {error && <p role="alert">{error}</p>}
    </div>,
  };
}

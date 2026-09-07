"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ClientPicker } from './client-picker';
import styles from './studio.module.css';
export function ImmersiveStudio({ id, name, panel, setPanel, actions, graph, inspector, handoffs, execution, error, busy }: {
  id: string; name: string; panel: string; setPanel: (value: string) => void; actions: ReactNode; graph: ReactNode;
  inspector: ReactNode; handoffs: ReactNode; execution: ReactNode; error: string; busy: boolean;
}) {
  const { lang } = useLanguage(), es = lang === 'es';
  const [picker, setPicker] = useState(false);
  const dock = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (panel) dock.current?.focus({ preventScroll: true }); }, [panel]);
  function close() { setPanel(''); trigger.current?.focus(); }
  return <div className={styles.immersive} data-studio-workspace data-studio-busy={busy} data-immersive-studio>
    <header className={styles.canvasHeader}>
      <Link href="/" aria-label={es ? 'Volver al dashboard' : 'Back to dashboard'}>Voysse <strong>Studio</strong></Link>
      <Button variant="outline" aria-expanded={picker} onClick={() => setPicker(!picker)}>{name || (es ? 'Cliente' : 'Client')}<ChevronDown /></Button>
      <div className={styles.canvasActions}>{actions}<LanguageSwitcher /><ThemeToggle /></div>
    </header>
    <div hidden={!picker} className={styles.canvasPicker}><ClientPicker current={id} /></div>
    <div className={styles.canvasStage}>
      {graph}
      <nav className={styles.canvasTools} aria-label={es ? 'Herramientas de Studio' : 'Studio tools'}>
        {[['inspector', es ? 'Inspector' : 'Inspector'], ['handoffs', es ? 'Conexiones y pruebas' : 'Connections & tests'], ['execution', es ? 'Ejecuciones' : 'Executions']].map(([key, label], index) =>
          <Button key={key} ref={index === 0 ? trigger : undefined} variant={panel === key ? 'default' : 'outline'} aria-pressed={panel === key} onClick={() => setPanel(panel === key ? '' : key)}>{label}</Button>)}
      </nav>
      <aside ref={dock} tabIndex={-1} hidden={!panel} className={styles.canvasDock} aria-label={es ? 'Panel de Studio' : 'Studio panel'} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
        <div className={styles.dockHeader}><strong>{es ? 'Configuración y pruebas' : 'Settings & tests'}</strong><Button variant="ghost" size="icon" aria-label={es ? 'Cerrar panel' : 'Close panel'} onClick={close}><X /></Button></div>
        <div className={styles.dockBody}>
          <div hidden={panel !== 'inspector'}>{inspector}</div>
          <div hidden={panel !== 'handoffs'}>{handoffs}</div>
          <div hidden={panel !== 'execution'}>{execution}</div>
        </div>
      </aside>
      {error && <p className={styles.canvasError} role="alert">{error}</p>}
    </div>
  </div>;
}

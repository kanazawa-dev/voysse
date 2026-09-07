"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { User } from '@/types';
import styles from './studio.module.css';
type Client = { id: string; name: string; is_active: boolean };
export function ClientPicker({ current = '' }: { current?: string }) {
  const router = useRouter(), { lang } = useLanguage(), es = lang === 'es';
  const [clients, setClients] = useState<Client[] | null>(null), [search, setSearch] = useState('');
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api<User>('/auth/me', { signal: controller.signal }), api<Client[]>('/clients', { signal: controller.signal })]).then(([user, list]) => {
      if (controller.signal.aborted) return;
      if (user.role !== 'admin') { setError(es ? 'Studio solo está disponible para administradores.' : 'Studio is only available to administrators.'); return; }
      setClients(list); setError('');
      const key = `voysse.studio.client:${user.agency.id}:${user.id}`;
      if (current) {
        if (list.some(c => c.id === current)) { try { localStorage.setItem(key, current); } catch {} }
      } else {
        let previous = ''; try { previous = localStorage.getItem(key) || ''; } catch {}
        const target = list.find(c => c.id === previous) || list.find(c => c.is_active);
        if (target) router.replace(`/studio/${encodeURIComponent(target.id)}`);
      }
    }).catch(err => { if (!controller.signal.aborted) setError(messageFrom(err)); });
    return () => controller.abort();
  }, [current, retry, router, es]);
  function choose(id: string) {
    if (!id || id === current || !clients?.some(c => c.id === id)) return;
    if (document.querySelector('[data-studio-busy="true"]')) { setError(es ? 'Espera a que termine la operación antes de cambiar de cliente.' : 'Wait for the operation to finish before switching clients.'); return; }
    if (document.querySelector('[data-studio-dirty="true"]') && !window.confirm(es ? 'Hay cambios sin guardar. ¿Descartarlos y cambiar de cliente?' : 'There are unsaved changes. Discard them and switch clients?')) return;
    router.push(`/studio/${encodeURIComponent(id)}`);
  }
  const visible = clients?.filter(c => c.id === current || c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) || [];
  return <section className={`${styles.panel} ${styles.clientPicker}`} aria-label={es ? 'Cliente de Studio' : 'Studio client'}>
    {!current && <h1>Voysse Studio</h1>}
    <div className={styles.pickerFields}>
      <label>{es ? 'Buscar cliente' : 'Search clients'}<Input value={search} onChange={e => setSearch(e.target.value)} placeholder={es ? 'Nombre del cliente…' : 'Client name…'} /></label>
      <label>{es ? 'Cliente' : 'Client'}<select aria-label={es ? 'Cliente de Studio' : 'Studio client'} value={current} disabled={!clients?.length} onChange={e => choose(e.target.value)}>
        <option value="">{es ? 'Selecciona un cliente' : 'Select a client'}</option>
        {current && clients && !clients.some(c => c.id === current) && <option value={current}>{es ? 'Cliente no disponible' : 'Client unavailable'}</option>}
        {visible.map(c => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? (es ? ' · Inactivo' : ' · Inactive') : ''}</option>)}
      </select></label>
    </div>
    {error && <p role="alert">{error} <Button variant="ghost" onClick={() => setRetry(n => n + 1)}>{es ? 'Reintentar' : 'Retry'}</Button></p>}
    {!clients && !error && <p role="status">{es ? 'Cargando clientes…' : 'Loading clients…'}</p>}
    {clients?.length === 0 && <p>{es ? 'Crea tu primer cliente para abrir su canvas.' : 'Create your first client to open its canvas.'} <Link href="/clients/new">{es ? 'Crear cliente' : 'Create client'}</Link></p>}
    {clients && clients.length > 0 && !visible.some(c => c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p>{es ? 'No hay coincidencias.' : 'No matching clients.'}</p>}
  </section>;
}

"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, ArrowUpRight } from 'lucide-react';
import { api, messageFrom } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { BloubAvatar } from '@/components/bloub-avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { onboardingCopy } from './copy';

type Progress = { step: number; status: 'new' | 'in_progress' | 'completed'; revision: number };
export function OnboardingTour({ role }: { role: string }) {
  const { lang } = useLanguage(), t = onboardingCopy[lang], router = useRouter();
  const steps = role === 'admin' ? t.steps : t.operator;
  const [value, setValue] = useState<Progress | null>(null), [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const step = Math.min(value?.step ?? 0, steps.length - 1), current = steps[step];
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    api<Progress>('/onboarding', { signal: controller.signal }).then(v => {
      if (controller.signal.aborted) return;
      if (!Number.isInteger(v.revision) || !Number.isInteger(v.step)) throw new Error(lang === 'es' ? 'No se pudo cargar el recorrido.' : 'Could not load the tour.');
      setValue(v); setOpen(v.status === 'new');
    }).catch(e => { if (!controller.signal.aborted) setError(messageFrom(e)); })
      .finally(() => { if (!controller.signal.aborted) request.current = null; });
    return () => { controller.abort(); request.current?.abort(); };
  }, [lang]);
  async function save(next: number, status: Progress['status'] = 'in_progress', href = '', close = false) {
    if (request.current || !value) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const result = await api<Progress>('/onboarding', { method: 'PUT', signal: controller.signal,
        body: JSON.stringify({ step: next, status, expected_revision: value.revision }) });
      if (controller.signal.aborted) return;
      setValue(result);
      if (close || status === 'completed' || href) setOpen(false);
      if (href) router.push(href);
    } catch (e) { if (!controller.signal.aborted) setError(messageFrom(e)); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  async function reload() {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try {
      const v = await api<Progress>('/onboarding', { signal: controller.signal });
      if (!Number.isInteger(v.revision) || !Number.isInteger(v.step)) throw new Error(t.retry);
      if (!controller.signal.aborted) { setValue(v); setError(''); }
    } catch (e) { if (!controller.signal.aborted) setError(messageFrom(e)); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  }
  function dismiss() {
    setOpen(false);
    if (value && !busy) void save(step, value.status === 'completed' ? 'completed' : 'in_progress');
  }
  return <>
    <Button variant="ghost" size="sm" aria-label={t.label} onClick={() => setOpen(true)}>
      <Compass size={16} /><span className="hidden sm:inline">{t.label}</span>
    </Button>
    <Dialog open={open} onOpenChange={next => {
      if (next) setOpen(true);
      else dismiss();
    }}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-md" data-onboarding-tour aria-busy={busy}>
        <DialogHeader>
          <div className="mb-4 flex items-center justify-between gap-3"><BloubAvatar size={40} mood="idle" /><span className="font-mono text-xs text-muted-foreground">{t.progress} {step + 1} {t.of} {steps.length}</span></div>
          <DialogTitle className="font-pixel text-xl">{current[0]}</DialogTitle>
          <DialogDescription className="pt-2 leading-relaxed">{current[1]}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1" aria-hidden="true">{steps.map((_, i) => <span key={i} className={`h-0.5 flex-1 ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
        {error && <div role="alert" className="text-sm text-destructive">{error}<Button variant="link" disabled={busy} onClick={() => void reload()}>{t.retry}</Button></div>}
        <div className="flex flex-wrap gap-2">
          {current[2] && <Button variant="outline" disabled={busy || !value} onClick={() => void save(step, 'in_progress', current[2])}>{t.action}<ArrowUpRight size={14} /></Button>}
          {value?.status === 'completed' ? <Button disabled={busy} onClick={() => void save(0)}>{t.repeat}</Button> : <Button disabled={busy || !value} onClick={() => void save(Math.min(step + 1, steps.length - 1), step === steps.length - 1 ? 'completed' : 'in_progress')}>{step === steps.length - 1 ? t.finish : t.next}</Button>}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.note}</p>
        <div className="flex justify-between"><Button variant="ghost" size="sm" disabled={busy || step === 0 || !value} onClick={() => void save(step - 1)}>{t.back}</Button><Button variant="ghost" size="sm" onClick={dismiss}>{t.later}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Building2, Clock, LoaderCircle, Mail, MessageSquareText, Phone, ShieldCheck } from "lucide-react";
import { ApiError, api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import DitherBackground from "@/components/ui/dither-background";
import { cn } from "@/lib/utils";

// Same light dither treatment as the dashboard's non-data welcome cards
// (home's "Next steps", the sidebar) — a brand touch, not a data surface.
function GrainLayer({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden="true">
      {isVisible ? (
        <DitherBackground
          className="absolute inset-0"
          colorNum={2.5}
          waveAmplitude={0.31}
          waveSpeed={0.01}
          waveFrequency={1.8}
          waveColor={[0.09, 0.282, 0.78]}
          backgroundColor={[0.98, 0.969, 0.937]}
          enableMouseInteraction={false}
          disableAnimation
        />
      ) : null}
      <div className="absolute inset-0 bg-background/85" />
    </div>
  );
}

// Temporary contact channel shown on a pending-approval account; swap for the
// company inbox once the new domain is live.
const PENDING_CONTACT_EMAIL = "alex@voysse.cl";
const PENDING_CONTACT_PHONE = "+56 9 4095 6827";
const PENDING_CONTACT_PHONE_HREF = "+56940956827";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pending")) setPending(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ agency: { is_active: boolean } }>(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(data) });
      if (!result.agency.is_active) {
        setPending(true);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.message === "agency_pending_approval") {
        setPending(true);
      } else {
        setError(messageFrom(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden bg-background">
      <GrainLayer className="lg:hidden" />
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LanguageSwitcher className="border bg-background/85 backdrop-blur" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 p-4 py-10 sm:p-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10">
        <div className="relative isolate hidden overflow-hidden rounded-4xl border bg-card p-8 lg:flex lg:flex-col lg:justify-between">
          <GrainLayer />
          <div className="relative z-10">
            <OpenvoissBrand effect="benday" showName size={34} state="thinking" />
            <span className="mt-8 block text-xs font-semibold tracking-widest text-primary uppercase">{t("auth.introEyebrow")}</span>
            <h1 className="mt-2 font-pixel text-3xl text-foreground">{t("auth.introTitle")}</h1>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">{t("auth.introDescription")}</p>
          </div>
          <div className="relative z-10 mt-8 rounded-2xl border bg-background/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2 font-semibold"><OpenvoissBrand decorative effect="benday" size={22} state="thinking" /> {t("auth.previewTitle")}</div>
              <small className="text-xs text-muted-foreground">{t("auth.previewToday")}</small>
            </div>
            <div className="grid grid-cols-3 gap-3 border-b py-4 text-center [&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground [&_strong]:text-xl [&_strong]:font-semibold">
              <div><small>{t("auth.previewClientsActive")}</small><strong>12</strong></div>
              <div><small>{t("auth.previewAgents")}</small><strong>28</strong></div>
              <div><small>{t("auth.previewConversations")}</small><strong>846</strong></div>
            </div>
            <div className="divide-y [&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground">
              <div className="flex items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 size={16} /></span><div className="min-w-0 flex-1"><strong>{t("auth.previewClinicName")}</strong><small>{t("auth.previewClinicMeta")}</small></div><span className="inline-flex shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("auth.previewActive")}</span></div>
              <div className="flex items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquareText size={16} /></span><div className="min-w-0 flex-1"><strong>{t("auth.previewInboxTitle")}</strong><small>{t("auth.previewInboxMeta")}</small></div><span className="inline-flex shrink-0 rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("auth.previewInboxTag")}</span></div>
              <div className="flex items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot size={16} /></span><div className="min-w-0 flex-1"><strong>{t("auth.previewKnowledgeTitle")}</strong><small>{t("auth.previewKnowledgeMeta")}</small></div><span className="inline-flex shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("auth.previewReady")}</span></div>
            </div>
          </div>
        </div>

        <Card className="mx-auto w-full max-w-md p-6 sm:p-8 lg:mx-0">
          <div className="mb-5 flex items-center gap-2 lg:hidden"><OpenvoissBrand effect="benday" showName size={30} state="thinking" /></div>

          {pending ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><Clock size={14} /> {t("auth.pendingEyebrow")}</span>
              <h2 className="mt-3 font-pixel text-2xl text-foreground">{t("auth.pendingTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("auth.pendingBody")}</p>
              <div className="mt-4 space-y-2.5">
                <a href={`mailto:${PENDING_CONTACT_EMAIL}`} className="flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium hover:border-primary/40 hover:text-primary"><Mail size={16} className="shrink-0 text-primary" /> {PENDING_CONTACT_EMAIL}</a>
                <a href={`tel:${PENDING_CONTACT_PHONE_HREF}`} className="flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium hover:border-primary/40 hover:text-primary"><Phone size={16} className="shrink-0 text-primary" /> {PENDING_CONTACT_PHONE}</a>
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">{t("auth.pendingSignature")}</p>
              <Button type="button" variant="ghost" className="mt-5 w-full" onClick={() => { setPending(false); setMode("login"); }}><ArrowLeft size={16} /> {t("auth.pendingBackToLogin")}</Button>
            </>
          ) : (
          <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><ShieldCheck size={14} /> {t("auth.cardLabel")}</span>
          <h2 className="mt-3 font-pixel text-2xl text-foreground">{mode === "register" ? t("auth.cardTitleRegister") : t("auth.cardTitleLogin")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "register" ? t("auth.cardSubtitleRegister") : t("auth.cardSubtitleLogin")}</p>

          <Tabs value={mode} onValueChange={(value) => { setMode(value as typeof mode); setError(""); }} className="mt-5">
            <TabsList className="w-full">
              <TabsTrigger value="login">{t("auth.tabLogin")}</TabsTrigger>
              <TabsTrigger value="register">{t("auth.tabRegister2")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "register" && <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agency_name">{t("auth.agencyName")}</Label>
                <Input id="agency_name" name="agency_name" required minLength={2} placeholder={t("auth.agencyNamePlaceholder")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">{t("auth.yourName")}</Label>
                <Input id="name" name="name" required minLength={2} placeholder={t("auth.yourNamePlaceholder")} />
              </div>
            </>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" name="email" required type="email" placeholder={t("auth.emailPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" name="password" required type="password" minLength={8} placeholder={t("auth.passwordPlaceholder")} />
            </div>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" size={17} />}
              {mode === "register" ? t("auth.submitRegister") : t("auth.submitLogin")}
            </Button>
          </form>
          <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck size={14} className="shrink-0" /> {t("auth.securityNote")}</p>
          </>
          )}
        </Card>
      </div>
    </div>
  );
}

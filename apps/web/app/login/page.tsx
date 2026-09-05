"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, LoaderCircle, Mail, Phone, ShieldCheck } from "lucide-react";
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


const PENDING_CONTACT_EMAIL = "alex@voysse.cl";
const PENDING_CONTACT_PHONE = "+56 9 4095 6827";
const PENDING_CONTACT_PHONE_HREF = "+56940956827";

export default function LoginPage() {
  const t = useT();
  const { lang: language } = useLanguage();
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

      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LanguageSwitcher className="border bg-background/85 backdrop-blur" />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-20 sm:px-0">
        <div className="mb-8 flex justify-center"><OpenvoissBrand effect="benday" showName size={30} state="idle" /></div>
        <Card className="cy-auth-card w-full gap-0 border-t-2 border-t-primary p-6 sm:p-8">
          {pending ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><Clock size={14} /> {t("auth.pendingEyebrow")}</span>
              <h1 className="mt-3 text-2xl font-medium tracking-tight text-foreground">{t("auth.pendingTitle")}</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("auth.pendingBody")}</p>
              <div className="mt-4 space-y-2.5">
                <a href={`mailto:${PENDING_CONTACT_EMAIL}`} className="flex items-center gap-2.5 rounded-sm border p-3 text-sm font-medium hover:border-primary/40 hover:text-primary"><Mail size={16} className="shrink-0 text-primary" /> {PENDING_CONTACT_EMAIL}</a>
                <a href={`tel:${PENDING_CONTACT_PHONE_HREF}`} className="flex items-center gap-2.5 rounded-sm border p-3 text-sm font-medium hover:border-primary/40 hover:text-primary"><Phone size={16} className="shrink-0 text-primary" /> {PENDING_CONTACT_PHONE}</a>
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">{t("auth.pendingSignature")}</p>
              <Button type="button" variant="ghost" className="mt-5 w-full" onClick={() => { setPending(false); setMode("login"); }}><ArrowLeft size={16} /> {t("auth.pendingBackToLogin")}</Button>
            </>
          ) : (
          <>
          <h1 className="mt-3 text-2xl font-medium tracking-tight text-foreground">{mode === "register" ? t("auth.cardTitleRegister") : t("auth.cardTitleLogin")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "register" ? t("auth.cardSubtitleRegister") : t("auth.cardSubtitleLogin")}</p>

          <Tabs value={mode} onValueChange={(value) => { setMode(value as typeof mode); setError(""); }} className="mt-5">
            <TabsList className="w-full rounded-none border bg-background p-1">
              <TabsTrigger className="rounded-none font-mono text-xs" value="login">{t("auth.tabLogin")}</TabsTrigger>
              <TabsTrigger className="rounded-none font-mono text-xs" value="register">{t("auth.tabRegister2")}</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "register" && <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agency_name">{t("auth.agencyName")}</Label>
                <Input id="agency_name" name="agency_name" autoComplete="organization" required minLength={2} placeholder={t("auth.agencyNamePlaceholder")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">{t("auth.yourName")}</Label>
                <Input id="name" name="name" autoComplete="name" required minLength={2} placeholder={t("auth.yourNamePlaceholder")} />
              </div>
            </>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" name="email" autoComplete="email" required type="email" placeholder={t("auth.emailPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required type="password" minLength={8} placeholder={t("auth.passwordPlaceholder")} />
            </div>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" size={17} />}
              {mode === "register" ? t("auth.submitRegister") : t("auth.submitLogin")}
            </Button>
          </form>
          {mode === "login" && <Link href="/forgot-password" className="mt-4 block text-sm underline">{language === "es" ? "¿Olvidaste tu contraseña?" : "Forgot your password?"}</Link>}
          <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck size={14} className="shrink-0" /> {t("auth.securityNote")}</p>
          </>
          )}
        </Card>
      </main>
    </div>
  );
}

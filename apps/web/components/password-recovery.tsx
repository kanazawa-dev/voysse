"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { BloubAvatar } from "@/components/bloub-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/language-switcher";

export function PasswordRecovery({
  reset = false,
  invitation = false,
}: {
  reset?: boolean;
  invitation?: boolean;
}) {
  const { lang: language } = useLanguage();
  const es = language === "es";
  const tokenRead = useRef(false);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(!reset);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reset || tokenRead.current) return;
    tokenRead.current = true;
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    // Keep the secret out of browser history, referrers and subsequent links.
    window.history.replaceState(null, "", window.location.pathname);
    setToken(value);
    setReady(true);
  }, [reset]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (reset && password !== data.get("confirm")) {
      setError(
        es ? "Las contraseñas no coinciden." : "Passwords do not match.",
      );
      return;
    }
    if (reset && new TextEncoder().encode(password).length > 72) {
      setError(
        es
          ? "Usa como máximo 72 bytes (algunos caracteres ocupan más de uno)."
          : "Use at most 72 bytes (some characters use more than one).",
      );
      return;
    }
    setBusy(true);
    try {
      await api(
        invitation
          ? "/team/accept"
          : reset
            ? "/auth/reset-password"
            : "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify(
            reset
              ? {
                  token,
                  password,
                  ...(invitation ? { name: data.get("name") } : {}),
                }
              : { email: data.get("email") },
          ),
        },
      );
      setDone(true);
      setToken("");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? es
            ? "La recuperación por correo aún no está configurada. Contacta al administrador."
            : "Email recovery is not configured yet. Contact your administrator."
          : invitation
            ? es
              ? "La invitación caducó, fue revocada o no se pudo aceptar. Pide al administrador un nuevo enlace."
              : "Invitation expired, was revoked, or could not be accepted. Ask your administrator for a new link."
            : reset
              ? es
                ? "El enlace no es válido, caducó o no se pudo completar. Solicita uno nuevo o inténtalo más tarde."
                : "The link is invalid, expired, or could not be processed. Request a new one or try again later."
              : es
                ? "No se pudo procesar la solicitud. Inténtalo más tarde."
                : "Could not process your request. Try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md space-y-5 rounded-4xl p-6 sm:p-8">
        <div className="flex justify-center">
          <BloubAvatar
            size={80}
            mood={busy ? "thinking" : error ? "error" : "listening"}
          />
        </div>
        <h1 className="text-2xl font-semibold">
          {invitation
            ? es
              ? "Únete al equipo"
              : "Join the team"
            : reset
              ? es
                ? "Nueva contraseña"
                : "New password"
              : es
                ? "Recupera tu acceso"
                : "Recover your account"}
        </h1>
        {done ? (
          <p role="status" className="text-sm leading-6">
            {invitation
              ? es
                ? "Invitación aceptada. Inicia sesión con tu correo y contraseña."
                : "Invitation accepted. Sign in with your email and password."
              : reset
                ? es
                  ? "Contraseña actualizada. Las sesiones anteriores se cerraron. Inicia sesión de nuevo."
                  : "Password updated. Previous sessions were revoked. Sign in again."
                : es
                  ? "Si existe una cuenta habilitada con ese correo, recibirás un enlace válido durante 30 minutos. Revisa también spam y espera un minuto antes de pedir otro."
                  : "If an eligible account exists, you will receive a link valid for 30 minutes. Check spam and wait a minute before requesting another."}
          </p>
        ) : !ready ? (
          <p role="status">{es ? "Preparando…" : "Preparing…"}</p>
        ) : reset && !token ? (
          <p role="alert">
            {invitation
              ? es
                ? "Falta el enlace de invitación. Pídelo al administrador."
                : "Missing invitation link. Ask your administrator."
              : es
                ? "Falta el enlace de recuperación. Solicita uno nuevo."
                : "Missing recovery link. Request a new one."}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {reset ? (
              <>
                {invitation && (
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      {es ? "Tu nombre" : "Your name"}
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={160}
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {invitation
                    ? es
                      ? "Usa al menos 12 caracteres. Este enlace determina tu correo y permisos."
                      : "Use at least 12 characters. This link determines your email and permissions."
                    : es
                      ? "Usa al menos 12 caracteres. Al guardar cerraremos todas las sesiones anteriores."
                      : "Use at least 12 characters. Saving revokes all previous sessions."}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {es ? "Nueva contraseña" : "New password"}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">
                    {es ? "Confirmar contraseña" : "Confirm password"}
                  </Label>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">
                  {es ? "Correo electrónico" : "Email address"}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? es
                  ? "Procesando…"
                  : "Processing…"
                : reset
                  ? es
                    ? "Guardar contraseña"
                    : "Save password"
                  : es
                    ? "Enviar enlace"
                    : "Send link"}
            </Button>
          </form>
        )}
        {reset && !invitation && !done && (
          <Link className="block text-sm underline" href="/forgot-password">
            {es ? "Solicitar otro enlace" : "Request another link"}
          </Link>
        )}
        <Link className="block text-sm underline" href="/login">
          {es ? "Volver a iniciar sesión" : "Back to sign in"}
        </Link>
      </Card>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/toast";
import { api, messageFrom } from "@/lib/api";
import { useT, type TranslateFn } from "@/lib/i18n";
import { PROVIDERS } from "@/lib/providers";
import type { Agency, Provider, ProviderTest } from "@/types";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SettingsPage() {
  const t = useT();
  const toast = useToast();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [busy, setBusy] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [a, p] = await Promise.all([
      api<Agency>("/agency"),
      api<Provider[]>("/providers"),
    ]);
    setAgency(a);
    setProviders(p);
  };
  useEffect(() => {
    load();
  }, []);

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      setAgency(
        await api<Agency>("/agency", {
          method: "PATCH",
          body: JSON.stringify({
            name: data.get("name"),
            slug: data.get("slug"),
            brand_color: data.get("brand_color"),
          }),
        }),
      );
      toast.success(t("settings.index.agencySaved"));
    } catch (err) {
      toast.error(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    setBusy(true);
    const data = new FormData();
    data.append("file", file);
    try {
      setAgency(
        await api<Agency>("/agency/logo", { method: "POST", body: data }),
      );
      setLogoVersion((v) => v + 1);
      toast.success(t("settings.index.logoUpdated"));
    } catch (err) {
      toast.error(messageFrom(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function deleteLogo() {
    await api("/agency/logo", { method: "DELETE" });
    setLogoVersion((v) => v + 1);
    await load();
  }

  async function saveKey(provider: string, apiKey: string): Promise<boolean> {
    if (!apiKey.trim()) return false;
    setBusy(true);
    try {
      // Validate the connection before storing; on failure nothing is saved.
      const test = await api<ProviderTest>(`/providers/${provider}/validate`, {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
      });
      await api(`/providers/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ api_key: apiKey }),
      });
      toast.success(test.message);
      await load();
      return true;
    } catch (err) {
      toast.error(messageFrom(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function removeKey(provider: string) {
    await api(`/providers/${provider}`, { method: "DELETE" });
    await load();
  }

  if (!agency)
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" /> {t("settings.index.loading")}
      </div>
    );
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHead
        eyebrow={t("settings.index.eyebrow")}
        title={t("settings.index.title")}
        description={t("settings.index.description")}
      />

      <form className="flex w-full flex-col gap-6" onSubmit={saveIdentity}>
        <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]">
          <div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
            <h2 className="font-heading">
              {t("settings.index.identityHeading")}
            </h2>
            <p>{t("settings.index.identityCopy")}</p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                type="button"
                variant="outline"
                className="size-20 overflow-hidden rounded-xl p-0 [&_img]:max-h-full [&_img]:max-w-full"
                onClick={() => fileRef.current?.click()}
              >
                {agency.logo_url ? (
                  <img
                    src={`${agency.logo_url}?v=${logoVersion}`}
                    alt={t("settings.index.logoAlt")}
                  />
                ) : (
                  <ImagePlus size={24} />
                )}
              </Button>
              <div>
                <strong>{t("settings.index.logoLabel")}</strong>
                <small>{t("settings.index.logoHint")}</small>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="link"
                    className="px-0"
                    onClick={() => fileRef.current?.click()}
                  >
                    {t("settings.index.change")}
                  </Button>
                  {agency.logo_url && (
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-destructive"
                      onClick={deleteLogo}
                    >
                      <Trash2 size={14} /> {t("settings.index.remove")}
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => uploadLogo(e.target.files?.[0])}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agency-name">
                  {t("settings.index.agencyName")}
                </Label>
                <Input
                  id="agency-name"
                  name="name"
                  required
                  defaultValue={agency.name}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agency-slug">
                  {t("settings.index.identifier")}
                </Label>
                <Input
                  id="agency-slug"
                  name="slug"
                  required
                  defaultValue={agency.slug}
                />
              </div>
            </div>
            <label>
              {t("settings.index.brandColor")}
              <div className="flex items-center gap-2 [&_input[type=color]]:size-10 [&_input[type=color]]:rounded-lg [&_input[type=color]]:border [&_input[type=color]]:p-1">
                <input
                  type="color"
                  name="brand_color"
                  defaultValue={agency.brand_color}
                />
                <Input defaultValue={agency.brand_color} readOnly />
              </div>
            </label>
          </div>
        </Card>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
          <Button type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}{" "}
            {t("settings.index.saveIdentity")}
          </Button>
        </div>
      </form>

      <Card className="grid gap-6 overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-secondary/35 p-5 shadow-sm md:grid-cols-[minmax(12rem,1fr)_2fr] md:items-center">
        <div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
          <span className="mb-2 block font-pixel text-[10px] uppercase tracking-[0.16em] text-primary/70">Voysse</span>
          <h2 className="font-heading">{t("settings.index.languageHeading")}</h2>
          <p>{t("settings.index.languageCopy")}</p>
        </div>
        <div className="flex justify-start md:justify-end">
          <LanguageSwitcher className="h-11 w-full max-w-56 justify-between border border-primary/20 bg-white/80 px-4 font-semibold shadow-sm hover:bg-white sm:w-56" />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3 [&_h2]:text-lg [&_h2]:font-semibold">
          <div>
            <h2 className="font-heading">{t("settings.providers.heading")}</h2>
            <p>{t("settings.providers.copy")}</p>
          </div>
        </div>
        <Alert className="border-amber-200 bg-amber-50 *:[svg]:text-amber-600">
          <ShieldCheck size={20} />
          <AlertTitle className="text-amber-900">
            {t("settings.index.privateCredentials")}
          </AlertTitle>
          <AlertDescription className="text-amber-800">
            {t("settings.index.privateCredentialsCopy")}
          </AlertDescription>
        </Alert>
        {PROVIDERS.map((preset) => (
          <ProviderKeyCard
            key={preset.id}
            preset={preset}
            state={providers.find((x) => x.provider === preset.id)}
            busy={busy}
            onSave={saveKey}
            onRemove={removeKey}
            t={t}
          />
        ))}
      </Card>
    </div>
  );
}

function ProviderKeyCard({
  preset,
  state,
  busy,
  onSave,
  onRemove,
  t,
}: {
  preset: (typeof PROVIDERS)[number];
  state?: Provider;
  busy: boolean;
  onSave: (p: string, k: string) => Promise<boolean>;
  onRemove: (p: string) => Promise<void>;
  t: TranslateFn;
}) {
  const [key, setKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const configured = Boolean(state?.configured) && !replacing;

  async function save() {
    if (await onSave(preset.id, key)) {
      setKey("");
      setReplacing(false);
    }
  }

  return (
    <Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]">
      <div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
        <h2 className="font-heading">{preset.label}</h2>
        <p>{t("settings.providers.byo", { label: preset.label })}</p>
      </div>
      <div className="space-y-4">
        {configured ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 size={18} />{" "}
              {t("settings.providers.configured", { label: preset.label })}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setKey("");
                  setReplacing(true);
                }}
              >
                {t("settings.providers.replace")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => onRemove(preset.id)}
              >
                <Trash2 size={15} /> {t("settings.providers.remove")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider-key">
                {t("settings.providers.apiKey", { label: preset.label })}
              </Label>
              <div className="relative">
                <Input
                  id="provider-key"
                  type={reveal ? "text" : "password"}
                  value={key}
                  autoComplete="new-password"
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={preset.keyPlaceholder}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={t(
                    reveal
                      ? "settings.providers.hide"
                      : "settings.providers.reveal",
                  )}
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-5">
              {state?.configured ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setKey("");
                    setReplacing(false);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                disabled={busy || !key.trim()}
                onClick={save}
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}{" "}
                {t("settings.providers.save")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHead } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/toast";
import { Switch } from "@/components/ui/switch";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Client } from "@/types";
import { Card } from "@/components/ui/card";

export default function NewClientPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const created = await api<Client>("/clients", { method: "POST", body: JSON.stringify({ name: data.get("name"), industry: data.get("industry"), description: data.get("description"), general_context: data.get("general_context"), is_active: data.get("is_active") === "on" }) });
      router.push(`/clients/${created.id}`);
    } catch (err) { toast.error(messageFrom(err)); setBusy(false); }
  }
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6"><Link href="/clients" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={17} /> {t("clients.new.back")}</Link><PageHead eyebrow={t("clients.new.eyebrow")} title={t("clients.new.title")} description={t("clients.new.description")} />
    <form className="mx-auto flex w-full max-w-5xl flex-col gap-6" onSubmit={submit}><Card className="grid gap-6 p-5 md:grid-cols-[minmax(12rem,1fr)_2fr]"><div className="[&_h2]:font-semibold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground"><h2 className="font-heading">{t("clients.new.generalInfo")}</h2><p>{t("clients.new.generalInfoCopy")}</p></div><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><Label htmlFor="name">{t("clients.new.name")}</Label><Input id="name" name="name" required autoFocus placeholder={t("clients.new.namePlaceholder")} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="industry">{t("clients.new.industry")}</Label><Input id="industry" name="industry" placeholder={t("clients.new.industryPlaceholder")} /></div></div><div className="flex flex-col gap-1.5"><Label htmlFor="description">{t("clients.new.descriptionLabel")}</Label><Textarea id="description" name="description" rows={3} placeholder={t("clients.new.descriptionPlaceholder")} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="general_context">{t("clients.new.generalContext")}</Label><Textarea id="general_context" name="general_context" rows={8} placeholder={t("clients.new.generalContextPlaceholder")} /><span className="mt-1.5 text-xs text-muted-foreground">{t("clients.new.generalContextHelp")}</span></div><label className="flex items-center justify-between gap-4 rounded-lg border p-3 [&_p]:text-sm [&_p]:text-muted-foreground"><span><strong>{t("clients.new.activeClient")}</strong><small>{t("clients.new.activeClientHint")}</small></span><Switch name="is_active" defaultChecked /></label></div></Card><div className="flex flex-wrap justify-end gap-2 border-t pt-5"><Button variant="secondary" render={<Link href="/clients" />}>{t("clients.new.cancel")}</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} {t("clients.new.createClient")}</Button></div></form>
  </div>;
}

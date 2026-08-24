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
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Client } from "@/types";

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
  return <div className="page narrow-page"><Link href="/clients" className="back-link"><ArrowLeft size={17} /> {t("clients.new.back")}</Link><PageHead eyebrow={t("clients.new.eyebrow")} title={t("clients.new.title")} description={t("clients.new.description")} />
    <form className="page-form" onSubmit={submit}><section className="form-section"><div className="section-copy"><h2>{t("clients.new.generalInfo")}</h2><p>{t("clients.new.generalInfoCopy")}</p></div><div className="form-fields"><div className="form-grid"><div className="flex flex-col gap-1.5"><Label htmlFor="name">{t("clients.new.name")}</Label><Input id="name" name="name" required autoFocus placeholder={t("clients.new.namePlaceholder")} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="industry">{t("clients.new.industry")}</Label><Input id="industry" name="industry" placeholder={t("clients.new.industryPlaceholder")} /></div></div><div className="flex flex-col gap-1.5"><Label htmlFor="description">{t("clients.new.descriptionLabel")}</Label><Textarea id="description" name="description" rows={3} placeholder={t("clients.new.descriptionPlaceholder")} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="general_context">{t("clients.new.generalContext")}</Label><Textarea id="general_context" name="general_context" rows={8} placeholder={t("clients.new.generalContextPlaceholder")} /><span className="field-help">{t("clients.new.generalContextHelp")}</span></div><label className="switch-row"><span><strong>{t("clients.new.activeClient")}</strong><small>{t("clients.new.activeClientHint")}</small></span><input name="is_active" type="checkbox" defaultChecked /></label></div></section><div className="form-footer"><Button variant="secondary" render={<Link href="/clients" />}>{t("clients.new.cancel")}</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} {t("clients.new.createClient")}</Button></div></form>
  </div>;
}

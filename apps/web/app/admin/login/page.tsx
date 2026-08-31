"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { api, messageFrom } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpenvoissBrand } from "@/components/openvoiss-brand";

export default function AdminLoginPage() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/admin/auth/login", { method: "POST", body: JSON.stringify(data) });
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-2"><OpenvoissBrand effect="benday" showName size={30} state="thinking" /></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><ShieldCheck size={14} /> {t("admin.login.eyebrow")}</span>
        <h1 className="mt-3 font-pixel text-2xl text-foreground">{t("admin.login.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.login.subtitle")}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email">{t("admin.login.email")}</Label>
            <Input id="admin-email" name="email" required type="email" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-password">{t("admin.login.password")}</Label>
            <Input id="admin-password" name="password" required type="password" />
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" size={17} />}
            {t("admin.login.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

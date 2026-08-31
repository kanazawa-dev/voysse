"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// There's no self-serve checkout for Voysse Cloud yet -- this records
// interest for the team to follow up with instead of a real payment flow.
export function CloudInterestDialog({ triggerClassName }: { triggerClassName?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/api/public/cloud-interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setStatus("idle");
      }}
    >
      <DialogTrigger render={<Button className={triggerClassName} variant="secondary" />}>
        {t("welcome.plans.cloud.cta")}
      </DialogTrigger>
      <DialogContent>
        {status === "success" ? (
          <DialogHeader>
            <DialogTitle>{t("welcome.plans.cloud.formSuccessTitle")}</DialogTitle>
            <DialogDescription>{t("welcome.plans.cloud.formSuccessBody")}</DialogDescription>
          </DialogHeader>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("welcome.plans.cloud.formTitle")}</DialogTitle>
              <DialogDescription>{t("welcome.plans.cloud.formBody")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cloud-lead-name">{t("welcome.plans.cloud.formName")}</Label>
              <Input id="cloud-lead-name" name="name" required minLength={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cloud-lead-agency">{t("welcome.plans.cloud.formAgency")}</Label>
              <Input id="cloud-lead-agency" name="agency_name" required minLength={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cloud-lead-email">{t("welcome.plans.cloud.formEmail")}</Label>
              <Input id="cloud-lead-email" name="email" type="email" required />
            </div>
            {status === "error" && <p className="text-sm text-destructive">{t("welcome.plans.cloud.formError")}</p>}
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto" disabled={status === "submitting"}>
                {status === "submitting" && <LoaderCircle className="size-4 animate-spin" />}
                {t("welcome.plans.cloud.formSubmit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

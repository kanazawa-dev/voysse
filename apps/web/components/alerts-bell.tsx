"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Check, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useT, type I18nKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Alert } from "@/types";

const POLL_MS = 60_000;

export function AlertsBell() {
  const t = useT();
  const [items, setItems] = useState<Alert[]>([]);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const load = () => api<Alert[]>("/alerts").then(setItems).catch(() => {});
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function resolve(alert: Alert) {
    setBusyId(alert.id);
    try {
      await api(`/alerts/${alert.id}/resolve`, { method: "POST" });
      setItems((prev) => prev.filter((item) => item.id !== alert.id));
    } finally {
      setBusyId("");
    }
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={t("alerts.bell")} className="relative" />}>
        <Bell size={17} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="max-h-96 divide-y overflow-y-auto">
          {items.length ? items.map((alert) => (
            <div key={alert.id} className="flex items-start gap-2.5 p-3 text-sm">
              <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${alert.severity === "error" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                <AlertTriangle size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{alert.title}</p>
                {alert.message && <p className="mt-0.5 truncate text-xs text-muted-foreground">{alert.message}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{t(`alerts.types.${alert.type}` as I18nKey) || alert.type} · {new Date(alert.created_at).toLocaleString()}</p>
              </div>
              <Button type="button" size="icon-sm" variant="ghost" disabled={busyId === alert.id} onClick={() => resolve(alert)} aria-label={t("alerts.resolve")}>
                {busyId === alert.id ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}
              </Button>
            </div>
          )) : <p className="p-6 text-center text-sm text-muted-foreground">{t("alerts.empty")}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

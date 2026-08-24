"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("shell.language")}>
      <Languages className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
      <Button type="button" size="xs" variant={lang === "en" ? "secondary" : "ghost"} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</Button>
      <Button type="button" size="xs" variant={lang === "es" ? "secondary" : "ghost"} onClick={() => setLang("es")} aria-pressed={lang === "es"}>ES</Button>
    </div>
  );
}

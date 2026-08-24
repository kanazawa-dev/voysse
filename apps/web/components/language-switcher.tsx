"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

// Compact EN/ES toggle used in the sidebar footer.
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="flex items-center gap-1 rounded-lg bg-sidebar-accent/60 p-1 text-xs text-sidebar-foreground" role="group" aria-label={t("shell.language")}>
      <Languages size={14} />
      <Button type="button" size="xs" variant={lang === "en" ? "secondary" : "ghost"} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</Button>
      <Button type="button" size="xs" variant={lang === "es" ? "secondary" : "ghost"} onClick={() => setLang("es")} aria-pressed={lang === "es"}>ES</Button>
    </div>
  );
}

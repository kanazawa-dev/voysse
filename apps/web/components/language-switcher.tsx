"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// Compact EN/ES toggle used in the sidebar footer.
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  return (
    <div className="lang-switcher" role="group" aria-label={t("shell.language")}>
      <Languages size={14} />
      <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button>
      <button className={lang === "es" ? "active" : ""} onClick={() => setLang("es")} aria-pressed={lang === "es"}>ES</button>
    </div>
  );
}

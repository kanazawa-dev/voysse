"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" aria-label={t("shell.language")} />}>
        <Globe className="size-4" />
        <span className="text-xs font-semibold uppercase">{lang}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-36">
        <DropdownMenuRadioGroup value={lang} onValueChange={(value) => setLang(value as (typeof LANGS)[number]["code"])}>
          {LANGS.map(({ code, label }) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

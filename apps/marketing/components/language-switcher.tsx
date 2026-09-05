"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("shell.language")}
            className="cy-language-trigger"
          />
        }
      >
        <Globe className="size-4" />
        <span>{lang.toUpperCase()}</span>
        <ChevronDown
          className="cy-language-chevron size-3"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="cy-language-menu w-40"
      >
        <DropdownMenuRadioGroup
          value={lang}
          onValueChange={(value) =>
            setLang(value as (typeof LANGS)[number]["code"])
          }
        >
          {LANGS.map(({ code, label }) => (
            <DropdownMenuRadioItem key={code} value={code} closeOnClick>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

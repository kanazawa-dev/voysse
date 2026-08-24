"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { en } from "./en";
import { es } from "./es";
import type { Dictionary } from "./en";

export type Lang = "en" | "es";

const dictionaries = { en, es };
const DEFAULT_LANG: Lang = "en";
const STORAGE_KEY = "openvoiss.lang";

// All valid dotted key paths derived from the dictionary shape. A typo in a
// t("…") call becomes a TypeScript error instead of a silent runtime fallback.
type DottedKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : DottedKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type I18nKey = DottedKeys<Dictionary>;

export type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Strict lookup: no silent fallback. A missing key is a bug we want to surface,
// not hide. Keys are type-checked at build time, so a runtime miss can only mean
// the dictionaries drifted — throw so it is caught immediately.
function lookup(lang: Lang, key: string): string {
  let node: unknown = dictionaries[lang];
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      throw new Error(`Missing i18n key "${key}" for language "${lang}"`);
    }
  }
  if (typeof node !== "string") {
    throw new Error(`i18n key "${key}" does not resolve to a string`);
  }
  return node;
}

function readStoredLang(): Lang {
  if (typeof document === "undefined") return DEFAULT_LANG;
  const match = document.cookie.match(/(?:^|;\s*)openvoiss\.lang=(en|es)/);
  if (match) return match[1] as Lang;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "es" || stored === "en" ? stored : DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR renders the default language; the stored preference is applied on mount
  // to avoid a hydration mismatch.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    setLangState(stored);
    document.documentElement.lang = stored;
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `openvoiss.lang=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const t = useCallback<TranslateFn>((key, vars) => {
    let text = lookup(lang, key);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
      }
    }
    return text;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

// Convenience hook when only the translate function is needed.
export function useT(): TranslateFn {
  return useLanguage().t;
}

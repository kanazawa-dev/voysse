"use client";

import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OpenvoissBrand } from "@/components/openvoiss-brand";
import type { LegalDoc } from "@/lib/legal/privacy";

export function LegalPage({ title, doc }: { title: string; doc: { es: LegalDoc; en: LegalDoc } }) {
  const { lang } = useLanguage();
  const content = doc[lang];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-[74px] w-full max-w-3xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Voysse"><OpenvoissBrand effect="benday" showName size={32} state="thinking" /></Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/" className="hidden items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground sm:flex"><ArrowLeft size={15} /> {lang === "en" ? "Back home" : "Volver al inicio"}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="font-pixel text-3xl text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{lang === "es" ? "Última actualización" : "Last updated"}: {content.updated}</p>

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{content.notice}</p>
        </div>

        <div className="mt-10 space-y-9">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-heading text-lg font-semibold text-foreground">{section.heading}</h2>
              <div className="mt-2 space-y-3">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-[15px] leading-7 text-muted-foreground">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

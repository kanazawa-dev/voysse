"use client";

import { useLanguage } from "@/lib/i18n";
import { LegalPage } from "@/components/legal-page";
import { terms } from "@/lib/legal/terms";

export default function TermsPage() {
  const { lang } = useLanguage();
  return <LegalPage title={lang === "es" ? "Términos de Servicio" : "Terms of Service"} doc={terms} />;
}

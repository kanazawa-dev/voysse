"use client";

import { useLanguage } from "@/lib/i18n";
import { LegalPage } from "@/components/legal-page";
import { privacy } from "@/lib/legal/privacy";

export default function PrivacyPage() {
  const { lang } = useLanguage();
  return <LegalPage title={lang === "es" ? "Política de Privacidad" : "Privacy Policy"} doc={privacy} />;
}

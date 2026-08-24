"use client";

import { PageHead } from "@/components/ui";
import { ChatPlayground } from "@/components/chat-playground";
import { useT } from "@/lib/i18n";

export default function PlaygroundPage() {
  const t = useT();
  return <div className="page playground-page"><PageHead eyebrow={t("playground.page.eyebrow")} title={t("playground.page.title")} description={t("playground.page.description")} /><ChatPlayground /></div>;
}

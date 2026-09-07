"use client";
import { useLanguage } from "@/lib/i18n";

export function UsageCost({ value }: { value: number | null | undefined }) {
  const { lang } = useLanguage();
  if (value == null) return <span>—</span>;
  const amount = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  return <span className="tabular-nums whitespace-nowrap">{value > 0 && value < 0.0001 ? "< 0.0001" : amount} USD</span>;
}

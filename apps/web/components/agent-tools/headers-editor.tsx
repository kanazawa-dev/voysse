"use client";

import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type HeaderRow = { key: string; value: string };

export function headersToDict(rows: HeaderRow[]): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const row of rows) if (row.key.trim()) dict[row.key.trim()] = row.value;
  return dict;
}

export function HeadersEditor({ rows, onChange }: { rows: HeaderRow[]; onChange: (rows: HeaderRow[]) => void }) {
  const t = useT();
  const update = (index: number, patch: Partial<HeaderRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" key={index}>
          <Input placeholder={t("tools.form.headerName")} value={row.key} onChange={(e) => update(index, { key: e.target.value })} />
          <Input placeholder={t("tools.form.headerValue")} value={row.value} onChange={(e) => update(index, { value: e.target.value })} />
          <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => onChange(rows.filter((_, i) => i !== index))} title={t("tools.delete")}>
            <Trash2 size={15} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus size={14} /> {t("tools.form.addHeader")}
      </Button>
    </div>
  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

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
    <div className="kv-editor">
      {rows.map((row, index) => (
        <div className="kv-row" key={index}>
          <input placeholder={t("tools.form.headerName")} value={row.key} onChange={(e) => update(index, { key: e.target.value })} />
          <input placeholder={t("tools.form.headerValue")} value={row.value} onChange={(e) => update(index, { value: e.target.value })} />
          <button type="button" className="icon-button danger-icon" onClick={() => onChange(rows.filter((_, i) => i !== index))} title={t("tools.delete")}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="button ghost align-start" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus size={14} /> {t("tools.form.addHeader")}
      </button>
    </div>
  );
}

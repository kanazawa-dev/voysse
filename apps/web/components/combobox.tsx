"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Searchable dropdown (autocomplete). Used for long option lists such as the
// timezone selector and the model picker.
//   - allowCustom: also accept a value typed by the user that is not in the list
//     (e.g. a model id we don't know yet). When false it behaves as a strict
//     searchable select.
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function close() { setOpen(false); setQuery(""); }
  function pick(option: string) { onChange(option); close(); }

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((option) => option.toLowerCase().includes(q)) : options;
  const canUseCustom = allowCustom && q.length > 0 && !options.some((option) => option.toLowerCase() === q);

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(""); }}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="w-full justify-between" />}>
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder}</span>
        <ChevronDown size={16} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) gap-1 p-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input className="pl-8" autoFocus value={query} placeholder={t("common.search")} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") close(); if (event.key === "Enter" && canUseCustom) { event.preventDefault(); pick(query.trim()); } }} />
        </div>
        <div className="max-h-56 overflow-y-auto" role="listbox">
          {canUseCustom && <Button type="button" variant="ghost" className="h-auto w-full justify-start rounded-xl p-2 text-left" onClick={() => pick(query.trim())}>{t("common.useValue", { value: query.trim() })}</Button>}
          {filtered.map((option) => <Button type="button" variant="ghost" className={`h-auto w-full justify-between rounded-xl px-2 py-1.5 text-left ${option === value ? "bg-accent font-medium" : ""}`} key={option} onClick={() => pick(option)}>{option}{option === value && <Check size={14} />}</Button>)}
          {!filtered.length && !canUseCustom && <div className="p-3 text-center text-sm text-muted-foreground">{t("common.noResults")}</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

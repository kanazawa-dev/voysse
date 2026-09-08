import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import type { SolutionSettings } from "@/lib/solutions";

export function SettingsFields({ value }: { value: SolutionSettings }) {
  const t = useT();
  return <div className="space-y-4">
    {(["instructions", "personality"] as const).map(field => <div key={field} className="space-y-2">
      <Label htmlFor={`solution-${field}`}>{t(`solutions.${field}`)}</Label>
      <Textarea id={`solution-${field}`} name={field} defaultValue={value[field]} rows={field === "instructions" ? 6 : 3}
        maxLength={field === "instructions" ? 32000 : 8000} />
    </div>)}
    <div className="grid gap-4 sm:grid-cols-3">
      {(["temperature", "max_tokens", "memory_limit"] as const).map(field => <div key={field} className="min-w-0 space-y-2">
        <Label htmlFor={`solution-${field}`}>{t(`solutions.${field}`)}</Label>
        <Input id={`solution-${field}`} name={field} type="number" required defaultValue={value[field]}
          min={field === "max_tokens" ? 1 : 0} max={field === "temperature" ? 2 : field === "max_tokens" ? 32000 : 200}
          step={field === "temperature" ? "any" : 1} />
      </div>)}
    </div>
  </div>;
}

export function readSettings(data: FormData): SolutionSettings {
  return { instructions: String(data.get("instructions") ?? ""), personality: String(data.get("personality") ?? ""),
    temperature: Number(data.get("temperature")), max_tokens: Number(data.get("max_tokens")), memory_limit: Number(data.get("memory_limit")) };
}

export function SettingsSummary({ value }: { value: SolutionSettings }) {
  const t = useT();
  return <dl className="space-y-4">{(["instructions", "personality", "temperature", "max_tokens", "memory_limit"] as const).map(field =>
    <div key={field}><dt className="text-sm font-medium text-muted-foreground">{t(`solutions.${field}`)}</dt>
      <dd className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">{String(value[field]) || "—"}</dd></div>)}</dl>;
}

import { ApiError } from "@/lib/api";
import type { I18nKey } from "@/lib/i18n";

export type SolutionSettings = { instructions: string; personality: string; temperature: number; max_tokens: number; memory_limit: number };
export type Solution = { id: string; name: string; latest_version: number; created_at: string };
export type SolutionVersion = { solution_id: string; number: number; settings: SolutionSettings };
export type Installation = { id: string; client_id: string; agent_id: string; version_number: number };
export const emptySettings: SolutionSettings = { instructions: "", personality: "", temperature: 0.7, max_tokens: 2048, memory_limit: 30 };
export function solutionError(error: unknown): I18nKey {
  if (error instanceof ApiError && [401, 403].includes(error.status)) return "solutions.denied";
  if (error instanceof ApiError && error.status === 422) return "solutions.invalid";
  return "solutions.loadError";
}

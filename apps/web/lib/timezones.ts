// Full IANA timezone list from the runtime when available, with a small
// fallback for older engines. Used by the agent settings timezone selector.
const FALLBACK = [
  "UTC",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
];

type SupportedValues = (key: "timeZone") => string[];

function resolve(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: SupportedValues };
  if (typeof intl.supportedValuesOf === "function") {
    try {
      return intl.supportedValuesOf("timeZone");
    } catch {
      return FALLBACK;
    }
  }
  return FALLBACK;
}

export const TIMEZONES: string[] = resolve();

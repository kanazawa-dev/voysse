// Shared by navigation and acquisition classification; keep deployment fallbacks identical.
export const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.voysse.cl").replace(/\/$/, "");

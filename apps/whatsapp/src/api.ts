const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
export const bridgeToken = process.env.WHATSAPP_BRIDGE_TOKEN || "dev-local-change-this-bridge-token";

export async function backend<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${backendUrl}/api/internal/whatsapp${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Token": bridgeToken,
      ...options.headers,
    },
  });
  if (!response.ok) {
    let detail = `FastAPI responded with ${response.status}`;
    try {
      const data = await response.json() as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {}
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function setStatus(
  channelId: string,
  status: "disconnected" | "connecting" | "qr" | "connected" | "reconnecting" | "error",
  extra: Record<string, unknown> = {},
): Promise<void> {
  await backend(`/channels/${channelId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, ...extra }),
  });
}

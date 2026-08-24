import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

try { loadEnvFile(resolve(process.cwd(), "../.env")); } catch {}

const [{ bridgeToken }, manager] = await Promise.all([
  import("./api.js"),
  import("./manager.js"),
]);

const port = Number(process.env.WHATSAPP_BRIDGE_PORT || 3101);
const host = process.env.WHATSAPP_BRIDGE_HOST || "127.0.0.1";

function json(response: ServerResponse, status: number, body?: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const part = Buffer.from(chunk);
    length += part.length;
    if (length > 100_000) throw new Error("Solicitud demasiado grande");
    chunks.push(part);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok" });
    if (request.headers["x-bridge-token"] !== bridgeToken) return json(response, 401, { error: "Invalid internal token" });
    const match = url.pathname.match(/^\/channels\/([0-9a-f-]+)\/(connect|disconnect|send)$/i);
    if (!match) return json(response, 404, { error: "Route not found" });
    const channelId = match[1]!;
    const action = match[2]!;
    if (request.method !== "POST") return json(response, 405, { error: "Method not allowed" });
    if (action === "connect") {
      await manager.connectChannel(channelId);
      return json(response, 202, { ok: true });
    }
    if (action === "disconnect") {
      await manager.disconnectChannel(channelId);
      return json(response, 200, { ok: true });
    }
    const payload = await body(request);
    if (typeof payload.remote_jid !== "string" || typeof payload.text !== "string" || !payload.text.trim()) {
      return json(response, 400, { error: "Invalid destination or message" });
    }
    const externalMessageId = await manager.sendMessage(channelId, payload.remote_jid, payload.text.trim());
    return json(response, 200, { external_message_id: externalMessageId });
  } catch (error) {
    console.error("[WhatsApp] Operation error:", (error as Error).message);
    return json(response, 500, { error: (error as Error).message });
  }
});

server.listen(port, host, () => {
  console.log(`[WhatsApp] Bridge ready at ${host}:${port}`);
  void manager.restoreChannels().catch((error) => console.error("[WhatsApp] Could not restore sessions:", error.message));
});

async function stop(): Promise<void> {
  await manager.shutdown();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());

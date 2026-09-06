import assert from "node:assert/strict";
import { test } from "node:test";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { processIncoming } from "../src/manager.js";

for (const durable of [true, false]) {
  test(durable ? "durable ACK does not trigger a second bridge send" : "old inline API remains compatible", async (t) => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const sends: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
      requests.push({ url, body: JSON.parse(options.body as string) });
      return url.endsWith("/inbound")
        ? Response.json({ accepted: true, reply: durable ? null : "Legacy reply", outbound_message_id: "old-message" })
        : new Response(null, { status: 204 });
    });
    const socket = {
      user: { id: "569123:4@s.whatsapp.net" },
      sendMessage: async (_jid: string, payload: { text: string }) => {
        sends.push(payload.text);
        return { key: { id: "confirmed" } };
      },
    } as unknown as WASocket;
    const message = {
      key: { id: "in-1", remoteJid: "123@s.whatsapp.net", fromMe: false },
      message: { conversation: "Hello" },
    } as WAMessage;
    await processIncoming("channel", socket, message);
    assert.ok(requests[0]);
    assert.equal(requests[0].body.source_phone_number, "569123");
    assert.equal(requests[0].body.external_message_id, "in-1");
    assert.equal(sends.length, durable ? 0 : 1);
    assert.equal(requests.length, durable ? 1 : 2);
    if (!durable) {
      assert.ok(requests[1]);
      assert.equal(requests[1].body.external_message_id, "confirmed");
    }
  });
}

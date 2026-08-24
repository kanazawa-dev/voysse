import assert from "node:assert/strict";
import test from "node:test";
import type { WAMessage } from "@whiskeysockets/baileys";
import { incomingText, isDirectIncoming } from "../src/messages.js";

function message(overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    key: { id: "abc", remoteJid: "573001234567@s.whatsapp.net", fromMe: false },
    message: { conversation: " Hello from WhatsApp " },
    messageTimestamp: 1,
    ...overrides,
  } as WAMessage;
}

test("extracts text from a direct conversation", () => {
  const item = message();
  assert.equal(isDirectIncoming(item), true);
  assert.equal(incomingText(item), "Hello from WhatsApp");
});

test("ignores own messages and groups", () => {
  assert.equal(isDirectIncoming(message({ key: { id: "a", remoteJid: "57300@s.whatsapp.net", fromMe: true } })), false);
  assert.equal(isDirectIncoming(message({ key: { id: "b", remoteJid: "group@g.us", fromMe: false } })), false);
});

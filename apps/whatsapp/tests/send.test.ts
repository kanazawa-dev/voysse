import assert from "node:assert/strict";
import { test } from "node:test";
import type { WASocket } from "@whiskeysockets/baileys";
import { sendBoundMessage } from "../src/send.js";

test("durable sends are bound to the current socket account", async () => {
  let calls = 0;
  const socket = {
    user: { id: "569123:4@s.whatsapp.net" },
    sendMessage: async () => { calls++; return { key: { id: "confirmed" } }; },
  } as unknown as WASocket;
  assert.equal(await sendBoundMessage(socket, "123@s.whatsapp.net", "Hi", "569123"), "confirmed");
  await assert.rejects(sendBoundMessage(socket, "123@s.whatsapp.net", "Hi", "999"), /account changed/);
  socket.user = undefined;
  await assert.rejects(sendBoundMessage(socket, "123@s.whatsapp.net", "Hi", "569123"), /account changed/);
  assert.equal(calls, 1);
});

test("legacy human sends remain supported but require confirmation", async () => {
  const socket = { sendMessage: async () => undefined } as unknown as WASocket;
  await assert.rejects(sendBoundMessage(socket, "123@s.whatsapp.net", "Hi"), /confirm/);
});

import type { WASocket } from "@whiskeysockets/baileys";

// Check the live socket identity, not a potentially stale database status.
export async function sendBoundMessage(
  socket: Pick<WASocket, "user" | "sendMessage">,
  remoteJid: string,
  text: string,
  expectedPhoneNumber?: string,
): Promise<string> {
  const actual = socket.user?.id.split(":")[0]?.split("@")[0];
  if (expectedPhoneNumber !== undefined && actual !== expectedPhoneNumber) {
    throw new Error("WhatsApp source account changed");
  }
  const sent = await socket.sendMessage(remoteJid, { text });
  if (!sent?.key.id) throw new Error("WhatsApp did not confirm the send");
  return sent.key.id;
}

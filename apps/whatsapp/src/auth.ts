import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { backend } from "./api.js";

export type StoredAuth = { creds: AuthenticationCreds; keys: Record<string, Record<string, unknown>> };

function revive<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;
}

function transport(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

export function createDatabaseAuth(channelId: string, stored?: unknown): {
  state: AuthenticationState;
  persist: () => Promise<void>;
} {
  const snapshot: StoredAuth = stored
    ? revive<StoredAuth>(stored)
    : { creds: initAuthCreds(), keys: {} };
  let pending = Promise.resolve();

  const persist = () => {
    pending = pending.then(async () => {
      await backend(`/channels/${channelId}/auth`, {
        method: "PUT",
        body: JSON.stringify({ auth_state: transport(snapshot) }),
      });
    });
    return pending;
  };

  const keys: AuthenticationState["keys"] = {
    get: <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
      const bucket = snapshot.keys[type] || {};
      const result: { [id: string]: SignalDataTypeMap[T] } = {};
      for (const id of ids) {
        if (bucket[id] !== undefined) result[id] = bucket[id] as SignalDataTypeMap[T];
      }
      return result;
    },
    set: async (data: SignalDataSet) => {
      for (const [type, entries] of Object.entries(data)) {
        const bucket = snapshot.keys[type] || (snapshot.keys[type] = {});
        for (const [id, value] of Object.entries(entries || {})) {
          if (value === null) delete bucket[id];
          else bucket[id] = value;
        }
      }
      await persist();
    },
    clear: async () => {
      snapshot.keys = {};
      await persist();
    },
  };

  return { state: { creds: snapshot.creds, keys }, persist };
}

import { EventEmitter } from "node:events";
import pg from "pg";
import { connectionString, pool } from "../db/pool.js";

// Shared channel: every change goes through Postgres NOTIFY, and each API instance keeps one
// LISTEN connection that fans the ping out to its own SSE clients. A bid handled by instance A
// (or a lot settled by the worker) therefore reaches rooms connected to instance B.
const CHANNEL = "lot_changed";
const RECONNECT_MS = 2_000;

const local = new EventEmitter();
local.setMaxListeners(0);

export function notifyLotChanged(lotId: string): void {
  pool.query("SELECT pg_notify($1, $2)", [CHANNEL, lotId]).catch((err) => console.error("lot notify failed", err));
}

let listener: Promise<void> | null = null;

// Started on the first subscription; reconnects on its own if the connection drops.
function ensureListener(): void {
  if (listener) return;
  const connect = async (): Promise<void> => {
    const client = new pg.Client({ connectionString });
    client.on("notification", (msg) => {
      if (msg.channel === CHANNEL && msg.payload) local.emit(msg.payload);
    });
    let retried = false;
    const retry = () => {
      if (retried) return;
      retried = true;
      client.removeAllListeners();
      client.on("error", () => {});
      client.end().catch(() => {});
      setTimeout(() => (listener = connect()), RECONNECT_MS).unref();
    };
    client.on("error", retry);
    client.on("end", retry);
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
    } catch (err) {
      console.error("lot listener failed", err);
      retry();
    }
  };
  listener = connect();
}

export function onLotChanged(lotId: string, listenerFn: () => void): () => void {
  ensureListener();
  local.on(lotId, listenerFn);
  return () => local.off(lotId, listenerFn);
}

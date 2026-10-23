import { EventEmitter } from "node:events";

// In-process pub/sub: one API instance, so no broker is needed.
// shortcut: breaks with more than one instance, move to Postgres LISTEN/NOTIFY or Redis then.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export const notifyLotChanged = (lotId: string) => emitter.emit(lotId);

export function onLotChanged(lotId: string, listener: () => void): () => void {
  emitter.on(lotId, listener);
  return () => emitter.off(lotId, listener);
}

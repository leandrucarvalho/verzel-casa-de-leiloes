import { fileURLToPath } from "node:url";
import { settleDueLots } from "./domain/settlement.js";

// Closes lots that reached their end time. Safe to run in several processes at once: settleLot
// locks the lot row and re-checks its status, so a lot is settled exactly once.
export function startSettlementLoop(everyMs = 15_000): () => void {
  const timer = setInterval(() => {
    settleDueLots().catch((err) => console.error("settlement job failed", err));
  }, everyMs);
  return () => clearInterval(timer);
}

// `node dist/worker.js` runs it alone, away from the HTTP process.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("settlement worker started");
  startSettlementLoop();
}

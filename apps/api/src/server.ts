import { createApp } from "./app.js";
import { startSettlementLoop } from "./worker.js";

const port = Number(process.env.PORT ?? 3333);
createApp().listen(port, () => {
  console.log(`API listening on :${port}`);
});

// EMBEDDED_WORKER=0 when a separate worker process (`npm run start:worker`) closes the lots.
// On a single free instance the default keeps the job inside the API; reads still settle lazily either way.
if (process.env.EMBEDDED_WORKER !== "0") startSettlementLoop();

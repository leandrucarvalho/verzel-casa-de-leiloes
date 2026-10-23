import { createApp } from "./app.js";
import { settleDueLots } from "./domain/settlement.js";

const port = Number(process.env.PORT ?? 3333);
createApp().listen(port, () => {
  console.log(`API listening on :${port}`);
});

setInterval(() => {
  settleDueLots().catch((err) => console.error("settlement job failed", err));
}, 15_000);

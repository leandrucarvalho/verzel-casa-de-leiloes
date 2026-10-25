import { defineConfig } from "vitest/config";

export default defineConfig({
  // e2e/ holds the Playwright smoke test, which has its own runner (npm run e2e)
  test: { exclude: ["e2e/**", "node_modules/**"] },
});

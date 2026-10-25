import { defineConfig } from "@playwright/test";

// Manual smoke test, not part of CI: it needs Postgres running and seeded (see "Teste ponta a ponta" in the README).
// E2E_WEB_PORT lets it run when port 3000 is taken by something else.
const webPort = process.env.E2E_WEB_PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    // the Chrome already installed on the machine, so no browser download is needed
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "npm run dev:api", cwd: "../..", url: "http://localhost:3333/health", reuseExistingServer: true, timeout: 60_000 },
    {
      command: `npx next dev --port ${webPort}`,
      url: `http://localhost:${webPort}`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:3333" },
    },
  ],
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/test/globalSetup.ts"],
    env: { DATABASE_URL: "postgres://leilao:leilao@localhost:5432/leilao_test" },
    // test files share one database
    fileParallelism: false,
  },
});

import path from "node:path";
import type { NextConfig } from "next";

// The Docker image sets NEXT_OUTPUT=standalone for a small runtime; Vercel and local dev keep the defaults.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  ...(standalone && {
    output: "standalone",
    // workspace deps are hoisted to the repo root, so trace from there
    outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

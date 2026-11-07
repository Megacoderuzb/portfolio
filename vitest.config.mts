import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// DB/Redis tests use the dev containers (docker compose -f docker-compose.dev.yml up -d db redis).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", setupFiles: ["tests/setup.ts"] },
});

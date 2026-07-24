import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // mirror cli/tsconfig.json: cli tests import @catladder/pipeline
      // from source, so they don't depend on a built pipeline/dist
      "@catladder/pipeline": fileURLToPath(
        new URL("./pipeline/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest/setup.ts"],
    // an explicit exclude replaces vitest's defaults, so everything we
    // want ignored has to be listed here — .claude holds agent worktrees,
    // i.e. full copies of this repo whose example tests would run twice
    exclude: [
      "**/dist/**",
      "**/__utils__/**",
      "**/node_modules/**",
      "**/.claude/**",
    ],
    include: ["**/__tests__/**/*.[jt]s?(x)", "**/pipeline/examples/*.test.ts"],
    testTimeout: 10000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest/setup.ts"],
    exclude: ["**/dist/**", "**/__utils__/**", "**/node_modules/**"],
    include: ["**/__tests__/**/*.[jt]s?(x)", "**/pipeline/examples/*.test.ts"],
    testTimeout: 10000,
  },
});

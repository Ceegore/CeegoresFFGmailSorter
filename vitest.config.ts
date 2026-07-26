import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/types/**"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});

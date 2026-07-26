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
      // Excluded: type-only files (no runtime code) and browser-extension entry
      // points whose logic only runs inside the WebExtension runtime (covered by
      // Playwright mock-E2E instead). See DECISIONS.md D-008.
      exclude: [
        "src/types/**",
        "src/app/events.ts",
        "src/shared/types.ts",
        "src/content/bootstrap.ts",
        "src/content/index.ts",
        "src/background/index.ts",
      ],
      // Thresholds reflect what the comprehensive unit+integration suite
      // genuinely proves. Remaining uncovered branches are defensive error
      // paths and Gmail-DOM-failure paths exercised by Playwright mock-E2E and
      // the human live gate, not unit tests. See DECISIONS.md D-008.
      thresholds: { lines: 89, functions: 89, branches: 73, statements: 86 },
    },
  },
});

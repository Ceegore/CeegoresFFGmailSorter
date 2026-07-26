import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const restrictedNetworkGlobals = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "artifacts/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".firefox-profile/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "*.config.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.webextensions, ...globals.es2022 },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/only-throw-error": "error",
      "no-restricted-globals": ["error", ...restrictedNetworkGlobals],
      "no-restricted-properties": [
        "error",
        {
          object: "navigator",
          property: "sendBeacon",
          message: "No network transmission is allowed.",
        },
        { object: "document", property: "cookie", message: "Cookie access is forbidden." },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.jest } },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js", "web-ext-config.mjs", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: { "no-restricted-globals": "off" },
  },
);

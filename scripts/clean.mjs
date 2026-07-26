import { rm } from "node:fs/promises";

await Promise.all([
  rm("dist", { recursive: true, force: true }),
  rm("coverage", { recursive: true, force: true }),
  rm("playwright-report", { recursive: true, force: true }),
  rm("test-results", { recursive: true, force: true }),
  rm("artifacts/release", { recursive: true, force: true }),
]);

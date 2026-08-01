import { rm } from "node:fs/promises";

await Promise.all([
  rm("dist", { recursive: true, force: true }),
  rm("coverage", { recursive: true, force: true }),
  rm("playwright-report", { recursive: true, force: true }),
  rm("test-results", { recursive: true, force: true }),
  rm("artifacts/release", { recursive: true, force: true }),
  // L-4: clean up the ephemeral Firefox profile created by the run scripts so
  // a `npm run clean` truly returns the worktree to a pristine state.
  rm(".firefox-profile", { recursive: true, force: true }),
]);

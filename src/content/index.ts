// Phase 01 minimal lifecycle. The full bootstrap (overlay host, store,
// controller, route observer) is wired in Phase 02 — see ./bootstrap.ts.
import { bootstrap } from "./bootstrap";

try {
  bootstrap();
} catch (error: unknown) {
  console.error("GISO content bootstrap failed", error);
}

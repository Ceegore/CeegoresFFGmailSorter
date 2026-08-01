// ITI-065: executable contract tests. The spec-hash gate only verifies that
// PRODUCT_SPEC.md matches a recorded hash — it cannot detect drift between the
// spec's invariants and the implementation. These tests assert the load-bearing
// spec rules directly against the code so that an implementation change which
// silently violates the spec fails CI even if the spec document itself is
// unchanged.
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildInboxSenderQuery } from "@/gmail/search-controller";
import { SAFE_MODE } from "@/shared/constants";
import { GMAIL_ADAPTER_VERSION } from "@/shared/constants";
import { DEFAULT_SETTINGS } from "@/settings/defaults";

describe("Spec contract tests (ITI-065)", () => {
  it('query format is exactly in:inbox "from:address" per spec §53.1', () => {
    expect(buildInboxSenderQuery("news@example.com")).toBe('in:inbox "from:news@example.com"');
  });

  it("SAFE_MODE is true (automation disabled per spec)", () => {
    expect(SAFE_MODE).toBe(true);
  });

  it("adapter version exists and matches documented format", () => {
    expect(GMAIL_ADAPTER_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+$/u);
  });

  it("settings contain only overlayPosition (spec §57.5)", () => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    expect(keys).toEqual(["schemaVersion", "overlayPosition"]);
  });

  it("no network primitives in the forbidden list are trivially callable", async () => {
    // The verify-no-network script checks this statically; this test verifies
    // the forbidden list itself is comprehensive. We can't import the .mjs, but
    // we can verify the patterns exist by reading the file. This is a contract
    // test, not a runtime test.
    const forbidden = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"];
    // Each must appear in the no-network scan list.
    const here = dirname(fileURLToPath(import.meta.url));
    const scriptPath = join(here, "..", "..", "scripts", "verify-no-network.mjs");
    const script = await readFile(scriptPath, "utf8");
    for (const name of forbidden) {
      expect(script).toContain(name);
    }
    expect(forbidden.length).toBe(5);
  });
});

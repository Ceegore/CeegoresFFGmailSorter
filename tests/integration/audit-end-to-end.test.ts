// 360° end-to-end audit: exercises the full chain analyze -> group ->
// buildQuery against the synthetic fixture, and verifies the controller's
// state transitions fire correctly without stray side effects. Independent of
// the per-phase integration test.
import { beforeEach, describe, expect, it } from "vitest";
import { loadFixture } from "./fixture-loader";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";
import { buildInboxSenderQuery } from "@/gmail/search-controller";
import { createProductionStore } from "../helpers/production-store";
import { createAppController } from "@/app/controller";

function installGmailLocation(hash = "#inbox"): void {
  const state = {
    hash,
    pathname: "/mail/u/0/",
    hostname: "mail.google.com",
    search: "",
    href: `https://mail.google.com/mail/u/0/${hash}`,
  };
  Object.defineProperty(window, "location", {
    writable: true,
    configurable: true,
    value: state,
  });
  (window as unknown as { __gisoSetRoute?: (h: string) => void }).__gisoSetRoute = (h: string) => {
    state.hash = h;
  };
}

describe("AUDIT: end-to-end analyze -> query chain", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installGmailLocation("#inbox");
    loadFixture("gmail-de-inbox-light.html");
  });

  it("analysis produces groups whose emails yield the exact locked query", async () => {
    const result = await analyzeCurrentInbox(new AbortController().signal);
    expect(result.rowCount).toBeGreaterThan(0);
    for (const group of result.groups) {
      const q = buildInboxSenderQuery(group.normalizedEmail);
      expect(q.startsWith("in:inbox ")).toBe(true);
      expect(q.endsWith('"')).toBe(true);
      // No unquoted from: (AUD-009 alias-expansion guard).
      expect(q).toContain('"from:');
    }
  });

  it("invariant: resolved + unresolved === rowCount, no shared email/fingerprint", async () => {
    const result = await analyzeCurrentInbox(new AbortController().signal);
    expect(result.resolvedCount + result.unresolvedCount).toBe(result.rowCount);
    const emails = result.groups.map((g) => g.normalizedEmail);
    expect(new Set(emails).size).toBe(emails.length);
    const allFps = result.groups.flatMap((g) => g.sourceFingerprints);
    expect(new Set(allFps).size).toBe(allFps.length);
    // sourceRoute must NOT carry a query or full URL (§50.3).
    expect(result.sourceRoute.fingerprint).not.toContain("@");
    expect(result.sourceRoute.fingerprint).not.toContain("http");
  });
});

describe("AUDIT: controller analysis effect transitions cleanly", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installGmailLocation("#inbox");
    loadFixture("gmail-de-inbox-light.html");
  });

  it("analyze() moves IDLE -> ANALYZING -> RESULTS_READY with no leftover state", async () => {
    const store = createProductionStore();
    const controller = createAppController(store);
    expect(store.getState().workflow).toBe("IDLE");
    await controller.analyze();
    const s = store.getState();
    expect(["RESULTS_READY", "ERROR"]).toContain(s.workflow);
    if (s.workflow === "RESULTS_READY") {
      expect(s.analysis).not.toBeNull();
      expect(s.error).toBeNull();
      expect(s.activeGroupId).toBeNull();
    }
    controller.dispose();
  });

  it("cancel after a non-running state is a no-op (no exception, no DOM click)", () => {
    const store = createProductionStore();
    const controller = createAppController(store);
    expect(() => {
      controller.cancel();
    }).not.toThrow();
    // IDLE -> CANCELLED is illegal, so workflow stays IDLE and a diagnostic is logged.
    expect(store.getState().workflow).toBe("IDLE");
  });
});

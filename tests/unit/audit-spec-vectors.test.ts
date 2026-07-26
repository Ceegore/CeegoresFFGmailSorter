// 360° audit suite: re-verifies the spec's mandatory test vectors and
// cross-cutting invariants, independent of the per-module tests. Treats all
// production code as suspect. Spec references in comments.
import { describe, expect, it } from "vitest";
import { normalizeEmail, parseEmailCandidate } from "@/analyzer/email-parser";
import { groupResolvedSenders } from "@/analyzer/grouping";
import { buildInboxSenderQuery } from "@/gmail/search-controller";
import { renderBrandCredit } from "@/ui/brand-credit";
import { reduceAppState, isCriticalWorkflow } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
import { createStore } from "@/app/store";
import { appError, GisoError, toAppError } from "@/shared/errors";
import { validateSettings } from "@/settings/storage";
import { redactUnknown } from "@/privacy/redact";
import type { AnalyzedEntry, SenderIdentity } from "@/shared/types";

// ---- §49.3 mandatory email-parser test vectors ----
describe("AUDIT: spec §49.3 email parser vectors", () => {
  it("EP-001 simple address", () => {
    expect(normalizeEmail("alice@example.com")).toEqual({ ok: true, value: "alice@example.com" });
  });
  it("EP-002 name + brackets, exact name 'Alice'", () => {
    const r = parseEmailCandidate("Alice <ALICE@Example.COM>");
    expect(r.ok && r.value.displayName).toBe("Alice");
    expect(r.ok && r.value.email).toBe("alice@example.com");
  });
  it("EP-003 plus tag preserved", () => {
    expect(normalizeEmail("<plus+tag@example.com>")).toEqual({
      ok: true,
      value: "plus+tag@example.com",
    });
  });
  it("EP-004 dots preserved", () => {
    expect(normalizeEmail("first.last@gmail.com")).toEqual({
      ok: true,
      value: "first.last@gmail.com",
    });
  });
  it("EP-005 parenthesised parsable", () => {
    expect(parseEmailCandidate("Name (a@example.com)").ok).toBe(true);
  });
  it("EP-006 two addresses => MULTIPLE_EMAILS", () => {
    expect(parseEmailCandidate("a@example.com b@example.com")).toEqual({
      ok: false,
      error: "MULTIPLE_EMAILS",
    });
  });
  it("EP-007 same address twice => one identity", () => {
    const r = parseEmailCandidate("a@example.com a@example.com");
    expect(r.ok && r.value.email).toBe("a@example.com");
  });
  it("EP-008 localhost rejected", () => {
    expect(normalizeEmail("a@localhost").ok).toBe(false);
  });
  it("EP-009 control char rejected", () => {
    expect(normalizeEmail("a\u0001b@example.com")).toEqual({
      ok: false,
      error: "CONTROL_CHARACTER",
    });
  });
  it("EP-012 IDN domain punycoded", () => {
    expect(normalizeEmail("user@bücher.de")).toEqual({ ok: true, value: "user@xn--bcher-kva.de" });
  });
  it("EP-013 leading dot local rejected", () => {
    expect(normalizeEmail(".alice@example.com").ok).toBe(false);
  });
  it("EP-014 double dot local rejected", () => {
    expect(normalizeEmail("alice..x@example.com").ok).toBe(false);
  });
  it("EP-015 domain with path/char rejected", () => {
    expect(normalizeEmail("a@example.com/path").ok).toBe(false);
  });
  it("EP-016 empty => EMPTY", () => {
    expect(normalizeEmail("")).toEqual({ ok: false, error: "EMPTY" });
  });
  it("query injection rejected (address with operator chars invalid)", () => {
    expect(() => buildInboxSenderQuery("a@example.com) OR in:anywhere")).toThrow();
  });
});

// ---- §50.4 grouping mandatory tests ----
function senderEntry(
  fp: string,
  email: string | null,
  confidence: SenderIdentity["confidence"],
  name: string | null,
): AnalyzedEntry {
  return {
    fingerprint: fp,
    rowIndex: 0,
    sender: {
      normalizedEmail: email,
      rawEmail: email,
      displayName: name,
      source: "email-attribute",
      confidence,
      diagnostics: [],
    },
  };
}

describe("AUDIT: spec §50.4 grouping invariants", () => {
  it("low/unresolved never grouped (FR-006, §14.4)", () => {
    const groups = groupResolvedSenders([
      senderEntry("a", "x@example.com", "low", "X"),
      senderEntry("b", "x@example.com", "low", "X"),
    ]);
    expect(groups).toHaveLength(0);
  });
  it("same name, different emails => two groups (AC-002)", () => {
    const groups = groupResolvedSenders([
      senderEntry("a", "x@example.com", "high", "Name"),
      senderEntry("b", "x@example.com", "high", "Name"),
      senderEntry("c", "y@example.com", "high", "Name"),
      senderEntry("d", "y@example.com", "high", "Name"),
    ]);
    expect(groups).toHaveLength(2);
  });
  it("singleton dropped (GISO-04)", () => {
    const groups = groupResolvedSenders([senderEntry("a", "x@example.com", "high", "X")]);
    expect(groups).toHaveLength(0);
  });
  it("duplicate fingerprints counted once", () => {
    const groups = groupResolvedSenders([
      senderEntry("same", "x@example.com", "high", "X"),
      senderEntry("same", "x@example.com", "high", "X"),
      senderEntry("other", "x@example.com", "high", "X"),
    ]);
    expect(groups[0]?.visibleEntryCount).toBe(2);
  });
});

// ---- §53.1 exact query (AC-003) ----
describe("AUDIT: spec §53.1 exact locked query", () => {
  it("news@example.com produces exact quoted inbox query", () => {
    expect(buildInboxSenderQuery("news@example.com")).toBe('in:inbox "from:news@example.com"');
  });
  it("uppercased input still produces lowercased quoted query", () => {
    expect(buildInboxSenderQuery("NEWS@Example.COM")).toBe('in:inbox "from:news@example.com"');
  });
});

// ---- §48 state machine critical invariants ----
describe("AUDIT: spec §48 state machine safety", () => {
  it("TOGGLE_OVERLAY cannot hide overlay during critical workflow (AUD-012)", () => {
    for (const wf of [
      "SETTING_SEARCH",
      "WAITING_SEARCH_RESULTS",
      "SELECTING_PAGE",
      "WAITING_SELECT_ALL",
      "MANUAL_SELECT_ALL",
      "OPENING_MOVE_MENU",
      "WAITING_TARGET_SELECTION",
      "VERIFYING_COMPLETION",
    ] as const) {
      expect(isCriticalWorkflow(wf)).toBe(true);
      const s = reduceAppState(
        { ...initialState, overlayVisible: true, workflow: wf },
        { type: "TOGGLE_OVERLAY" },
      );
      expect(s.overlayVisible).toBe(true);
    }
  });
  it("SEARCH_SUBMITTED only accepts controller-generated query (AUD-011)", () => {
    const s = reduceAppState(initialState, {
      type: "SEARCH_SUBMITTED",
      query: 'in:inbox "from:attacker@example.com"',
    });
    expect(s.workflow).toBe("IDLE");
  });
  it("illegal transition logs diagnostic but does not mutate workflow (§17.2)", () => {
    const s = reduceAppState(initialState, { type: "ALL_SELECTED" });
    expect(s.workflow).toBe("IDLE");
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
});

// ---- §56.3 brand credit ----
describe("AUDIT: spec §56.3 brand credit", () => {
  it("exact text, no link, has testid", () => {
    const c = renderBrandCredit();
    expect(c.textContent).toBe("made by Ceegore");
    expect(c.querySelector("a")).toBeNull();
    expect(c.dataset["testid"]).toBe("brand-credit");
  });
});

// ---- §57 privacy: storage never holds senders, redaction leak-proof ----
describe("AUDIT: spec §57 privacy", () => {
  it("settings validation rejects a senderHistory key (AC-008, TH-010)", () => {
    const out = validateSettings({
      overlayPosition: { top: 80, right: 16 },
      senderHistory: ["alice@example.com"],
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain("alice");
    expect(json).not.toContain("senderHistory");
    expect(out).toHaveProperty("schemaVersion", 1);
  });
  it("redaction removes nested emails, names, subjects (TH-007)", async () => {
    const out = await redactUnknown({
      sender: { displayName: "Alice Smith", email: "alice@example.com" },
      subject: "Private subject line",
      snippet: "secret snippet",
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain("alice@example.com");
    expect(json).not.toContain("Alice");
    expect(json).not.toContain("Private subject");
    expect(json).not.toContain("secret");
  });
});

// ---- store subscriber isolation (§48.6, UT-STORE-001) ----
describe("AUDIT: store subscriber isolation", () => {
  it("a throwing subscriber does not block others", () => {
    const store = createStore(initialState, reduceAppState);
    const calls: string[] = [];
    store.subscribe(() => {
      calls.push("good1");
    });
    store.subscribe(() => {
      throw new Error("boom");
    });
    store.subscribe(() => {
      calls.push("good2");
    });
    const spy = viFnSuppressConsoleError();
    store.dispatch({ type: "TOGGLE_OVERLAY" });
    spy.restore();
    expect(calls).toContain("good1");
    expect(calls).toContain("good2");
  });
});

// ---- errors: GisoError round-trip (controller contract) ----
describe("AUDIT: error objects are Error instances (only-throw-error compatible)", () => {
  it("throwAppError throws something toAppError can recover", () => {
    const app = appError("GISO-MOVE-001", "moveMenuFailed", "x", true);
    let caught: unknown;
    try {
      throw new GisoError(app);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(toAppError(caught).code).toBe("GISO-MOVE-001");
  });
});

// Helper: silence console.error during intentional subscriber failure.
function viFnSuppressConsoleError(): { restore: () => void } {
  const original = console.error;
  console.error = () => {
    /* swallow */
  };
  return { restore: () => (console.error = original) };
}

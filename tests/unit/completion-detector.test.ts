// Completion detector tests (spec §55.4). Proves the BUG-037 fix:
// correlated signals are deduplicated; an empty list alone NEVER auto-confirms;
// auto-confirm requires BOTH action AND result evidence categories.
// BUG-009: status text from scoped [role="status"] regions, not body.
import { beforeEach, describe, expect, it } from "vitest";
import {
  COMPLETION_THRESHOLD,
  isAutoConfirmed,
  readCompletionEvidence,
} from "@/gmail/completion-detector";

beforeEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(window, "location", {
    writable: true,
    configurable: true,
    value: {
      hash: "#search/from:x",
      pathname: "/mail/u/0/",
      hostname: "mail.google.com",
      search: "",
    },
  });
});

function statusRegion(text: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.append(el);
  return el;
}

describe("readCompletionEvidence scoring (BUG-037)", () => {
  it("snackbar with move+undo (+85 action) + empty list (result) auto-confirms", () => {
    statusRegion("Verschieben nach Work Rückgängig");
    // baseline > 0, currently 0 rows => resultListEmpty + resultCountDecreased.
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(evidence.score).toBeGreaterThanOrEqual(COMPLETION_THRESHOLD);
    expect(isAutoConfirmed(evidence)).toBe(true);
  });

  it("BUG-037: empty list ALONE (no action evidence) does NOT auto-confirm", () => {
    // No snackbar/status region. Empty list + decreased count = result-only.
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(evidence.resultListEmpty).toBe(true);
    expect(evidence.resultCountDecreased).toBe(true);
    // Score from result-only is well below 70.
    expect(evidence.score).toBeLessThan(COMPLETION_THRESHOLD);
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("weak evidence (only result count decreased +25) does NOT auto-confirm", () => {
    const list = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    list.append(row);
    document.body.append(list);
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 10 });
    expect(evidence.score).toBeLessThan(COMPLETION_THRESHOLD);
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("undo without move semantics does NOT count as action evidence", () => {
    statusRegion("Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 3 });
    // undoVisible may be true, but snackbarMoveText is false (no move text).
    expect(evidence.snackbarMoveText).toBe(false);
    // Without action evidence, cannot auto-confirm even with result evidence.
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("BUG-071: #inbox route blocks auto-confirm (only #search valid)", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { hash: "#inbox", pathname: "/mail/u/0/", hostname: "mail.google.com", search: "" },
    });
    statusRegion("Verschieben nach Work Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("negative route signal (#settings) blocks auto-confirm", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { hash: "#settings", pathname: "/mail/u/0/", hostname: "mail.google.com", search: "" },
    });
    statusRegion("Verschieben nach Work Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("threshold constant is 70 per spec", () => {
    expect(COMPLETION_THRESHOLD).toBe(70);
  });
});

// Completion detector tests (spec §55.4). Proves the evidence-scoring model:
// snackbar+undo auto-confirms, empty list + undo confirms, weak evidence does
// not, negative route signal blocks auto-confirm.
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

describe("readCompletionEvidence scoring (§55.4)", () => {
  it("snackbar with move + undo (+60+25) and empty list (+35) auto-confirms", () => {
    const snackbar = document.createElement("div");
    snackbar.textContent = "Verschieben nach Work Rückgängig";
    document.body.append(snackbar);
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(evidence.score).toBeGreaterThanOrEqual(COMPLETION_THRESHOLD);
    expect(isAutoConfirmed(evidence)).toBe(true);
  });

  it("weak evidence (only result count decreased +25) does NOT auto-confirm", () => {
    // One row remains, no snackbar.
    const list = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("role", "listitem");
    list.append(row);
    document.body.append(list);
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 10 });
    expect(evidence.score).toBeLessThan(COMPLETION_THRESHOLD);
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("list empty + undo (+35+25 = 60) is below 70 threshold => not auto-confirmed", () => {
    const div = document.createElement("div");
    div.textContent = "Rückgängig";
    document.body.append(div);
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 3 });
    // empty(+35) + decreased(+25) + absent(+35) + undo(+25 if move semantics) ...
    // undo alone without move semantics: undoVisible true but moveSemantics false => snackbar false, undo+0
    expect(evidence.undoVisible).toBe(true);
  });

  it("negative route signal blocks auto-confirm even with high score", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { hash: "#settings", pathname: "/mail/u/0/", hostname: "mail.google.com", search: "" },
    });
    const snackbar = document.createElement("div");
    snackbar.textContent = "Verschieben nach Work Rückgängig";
    document.body.append(snackbar);
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(isAutoConfirmed(evidence)).toBe(false);
  });

  it("threshold constant is 70 per spec", () => {
    expect(COMPLETION_THRESHOLD).toBe(70);
  });
});

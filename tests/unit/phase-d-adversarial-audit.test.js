// PHASE D ADVERSARIAL AUDIT: probes completion scoring (BUG-037), checkbox
// states (BUG-039), page-select evidence (BUG-006), and route enforcement
// (BUG-071) from unexpected angles.
import { beforeEach, describe, expect, it } from "vitest";
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
function statusRegion(text) {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.append(el);
  return el;
}
// ---- BUG-037: the original critical flaw — empty list = 95 points ----
describe("ADVERSARIAL D: BUG-037 empty list scoring", () => {
  it("empty list with baseline>0 scores WELL below 70 (was 95)", async () => {
    const { readCompletionEvidence } = await import("@/gmail/completion-detector");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 10 });
    expect(evidence.score).toBeLessThan(70);
    expect(evidence.resultListEmpty).toBe(true);
    expect(evidence.resultCountDecreased).toBe(true);
    // inboxMatchesAbsent must NOT be triple-counted.
    expect(evidence.inboxMatchesAbsent).toBe(true); // it's still true but worth little
  });
  it("empty list ALONE never auto-confirms even if baseline was huge", async () => {
    const { readCompletionEvidence, isAutoConfirmed } = await import("@/gmail/completion-detector");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 1000 });
    expect(isAutoConfirmed(evidence)).toBe(false);
  });
  it("snackbar+undo+empty list DOES auto-confirm (action+result)", async () => {
    const { readCompletionEvidence, isAutoConfirmed } = await import("@/gmail/completion-detector");
    statusRegion("Verschieben nach Work Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(isAutoConfirmed(evidence)).toBe(true);
  });
  it("undo WITHOUT move text does NOT auto-confirm", async () => {
    const { readCompletionEvidence, isAutoConfirmed } = await import("@/gmail/completion-detector");
    statusRegion("Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(evidence.snackbarMoveText).toBe(false);
    expect(isAutoConfirmed(evidence)).toBe(false);
  });
});
// ---- BUG-071: #inbox route during completion ----
describe("ADVERSARIAL D: BUG-071 route enforcement", () => {
  it("#inbox route blocks auto-confirm even with full evidence", async () => {
    const { readCompletionEvidence, isAutoConfirmed } = await import("@/gmail/completion-detector");
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { hash: "#inbox", pathname: "/mail/u/0/", hostname: "mail.google.com", search: "" },
    });
    statusRegion("Verschieben nach Work Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(isAutoConfirmed(evidence)).toBe(false);
  });
  it("#search route allows auto-confirm with full evidence", async () => {
    const { readCompletionEvidence, isAutoConfirmed } = await import("@/gmail/completion-detector");
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
    statusRegion("Verschieben nach Work Rückgängig");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 5 });
    expect(isAutoConfirmed(evidence)).toBe(true);
  });
});
// ---- BUG-039: checkbox state model ----
describe("ADVERSARIAL D: BUG-039 checkbox states", () => {
  it("selectCurrentPage with a 'mixed' checkbox clicks again to complete", async () => {
    const { selectCurrentPage } = await import("@/gmail/selection-controller");
    const toolbar = document.createElement("div");
    toolbar.setAttribute("role", "toolbar");
    const cb = document.createElement("div");
    cb.setAttribute("role", "checkbox");
    cb.setAttribute("aria-checked", "mixed");
    toolbar.append(cb);
    document.body.append(toolbar);
    // First click → checked (ARIA uses "true", not "checked").
    let clickCount = 0;
    cb.addEventListener("click", () => {
      clickCount++;
      if (clickCount === 1) cb.setAttribute("aria-checked", "true");
    });
    const ok = await selectCurrentPage(new AbortController().signal, { timeoutMs: 2000 });
    expect(ok).toBe(true);
    expect(cb.getAttribute("aria-checked")).toBe("true");
  });
  it("selectCurrentPage with already-checked checkbox does NOT click", async () => {
    const { selectCurrentPage } = await import("@/gmail/selection-controller");
    const toolbar = document.createElement("div");
    toolbar.setAttribute("role", "toolbar");
    const cb = document.createElement("div");
    cb.setAttribute("role", "checkbox");
    cb.setAttribute("aria-checked", "true");
    toolbar.append(cb);
    document.body.append(toolbar);
    let clicked = false;
    cb.addEventListener("click", () => {
      clicked = true;
    });
    const ok = await selectCurrentPage(new AbortController().signal, { timeoutMs: 500 });
    expect(ok).toBe(true);
    expect(clicked).toBe(false); // must not click an already-checked box
  });
});
// ---- BUG-006: page-select evidence (no arbitrary fallback) ----
describe("ADVERSARIAL D: BUG-006 page-select evidence", () => {
  it("rejects a checkbox outside a toolbar (no arbitrary fallback)", async () => {
    const { selectCurrentPage } = await import("@/gmail/selection-controller");
    // A bare checkbox NOT inside a toolbar.
    const cb = document.createElement("input");
    cb.type = "checkbox";
    document.body.append(cb);
    await expect(
      selectCurrentPage(new AbortController().signal, { timeoutMs: 500 }),
    ).rejects.toMatchObject({ app: { code: "GISO-SELECT-PAGE-001" } });
  });
  it("toolbar with buttons but NO checkbox fails (was falsely succeeding)", async () => {
    const { selectCurrentPage } = await import("@/gmail/selection-controller");
    const toolbar = document.createElement("div");
    toolbar.setAttribute("role", "toolbar");
    const btn = document.createElement("button");
    btn.textContent = "Archive";
    toolbar.append(btn);
    document.body.append(toolbar);
    // No checkbox in the toolbar → must fail, not succeed because buttons exist.
    await expect(
      selectCurrentPage(new AbortController().signal, { timeoutMs: 500 }),
    ).rejects.toMatchObject({ app: { code: "GISO-SELECT-PAGE-001" } });
  });
});
// ---- Cross-check: BUG-009 status text from body does NOT trigger move detection ----
describe("ADVERSARIAL D: BUG-009 subject text false positive", () => {
  it("email subject containing 'verschieben' in body does NOT trigger move evidence", async () => {
    // Put move-like text in body (NOT in a status region).
    const subjectDiv = document.createElement("div");
    subjectDiv.textContent = "Bitte verschieben Sie den Termin";
    document.body.append(subjectDiv);
    const { readCompletionEvidence } = await import("@/gmail/completion-detector");
    const evidence = readCompletionEvidence({ expectedQuery: null, baselineResultCount: 0 });
    // The move text is in body, not in a [role=status] region.
    expect(evidence.snackbarMoveText).toBe(false);
  });
});

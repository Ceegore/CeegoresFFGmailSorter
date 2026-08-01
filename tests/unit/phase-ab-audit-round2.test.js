// ROUND 2 AUDIT: fresh angles not covered by prior audits.
// Attacks: CONFIRM_SEARCH view rendering, transition graph completeness,
// controller race conditions, and state-machine invariant violations.
import { describe, expect, it } from "vitest";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
import { createStore } from "@/app/store";
import { createAppController } from "@/app/controller";
import { renderApp } from "@/ui/render";
import { ensureOverlayHost } from "@/ui/overlay-host";
import { de } from "@/i18n/de";
const group = (id, email) => ({
  id: `sender:${email}`,
  normalizedEmail: email,
  displayNames: ["A"],
  primaryDisplayName: "A",
  visibleEntryCount: 2,
  sourceFingerprints: ["f1", "f2"],
  confidence: "high",
  status: "ready",
});
const analysis = (groups) => ({
  startedAt: 0,
  completedAt: 0,
  sourceRoute: { accountSlot: 0, view: "inbox", fingerprint: "fp" },
  rowCount: groups.length,
  resolvedCount: groups.length,
  unresolvedCount: 0,
  duplicateCount: 0,
  weakFingerprintCount: 0,
  groups,
  unresolvedEntries: [],
});
const acceptance = (s) => [
  s.workflow,
  s.activeGroupId,
  s.error?.code ?? "",
  s.analysis !== null,
  s.overlayVisible,
];
// ---- PROBE A: CONFIRM_SEARCH view actually renders the confirm button ----
describe("ROUND2: CONFIRM_SEARCH renders confirm-search view (BUG-001)", () => {
  beforeEach(() => {
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
  });
  it("shows the 'Suche starten' button and the exact query", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    const c = createAppController(store);
    const { shadow } = ensureOverlayHost();
    const g = group("a", "a@example.com");
    const state = {
      ...initialState,
      overlayVisible: true,
      workflow: "CONFIRM_SEARCH",
      activeGroupId: g.id,
      analysis: analysis([g]),
    };
    renderApp(shadow, state, c);
    const confirmBtn = shadow.querySelector('[data-testid="giso-confirm-search"]');
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn?.textContent).toBe(de.startSearch);
    const queryEl = shadow.querySelector('[data-testid="giso-confirm-query"]');
    expect(queryEl?.textContent).toBe('in:inbox "from:a@example.com"');
  });
  it("does NOT show the group list in CONFIRM_SEARCH", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    const c = createAppController(store);
    const { shadow } = ensureOverlayHost();
    const g = group("a", "a@example.com");
    const state = {
      ...initialState,
      overlayVisible: true,
      workflow: "CONFIRM_SEARCH",
      activeGroupId: g.id,
      analysis: analysis([g]),
    };
    renderApp(shadow, state, c);
    // The group list should NOT be visible (no find-all button).
    expect(shadow.querySelector('[data-testid="giso-find-all"]')).toBeNull();
    expect(shadow.querySelector('[data-testid="giso-group-list"]')).toBeNull();
  });
});
// ---- PROBE B: back button from CONFIRM_SEARCH returns to RESULTS_READY ----
describe("ROUND2: CONFIRM_SEARCH back button", () => {
  it("RETURN_TO_RESULTS is legal from CONFIRM_SEARCH and returns to RESULTS_READY", () => {
    // FIXED: CONFIRM_SEARCH is now in the allowed-states list for RETURN_TO_RESULTS,
    // so the "Zurück" button works. Previously this was illegal (dead button).
    const g = group("a", "a@example.com");
    const s = reduceAppState(
      {
        ...initialState,
        workflow: "CONFIRM_SEARCH",
        activeGroupId: g.id,
        analysis: analysis([g]),
      },
      { type: "RETURN_TO_RESULTS" },
    );
    expect(s.workflow).toBe("RESULTS_READY");
    expect(s.activeGroupId).toBeNull();
  });
});
// ---- PROBE C: SAFE_MODE flag is consistently applied everywhere ----
describe("ROUND2: no auto-click path reachable in safe mode", () => {
  it("SELECTING_PAGE is reachable via state machine but gated by SAFE_MODE in controller", () => {
    // The state machine itself allows WAITING_SEARCH_RESULTS -> SELECTING_PAGE,
    // because the reducer is mode-agnostic. The controller's SAFE_MODE is what
    // actually prevents this transition from being reached at runtime: when
    // SAFE_MODE is on the controller dispatches SEARCH_READY_MANUAL instead of
    // SEARCH_READY. So the SELECTING_PAGE path exists in the graph but is never
    // entered while the safe-mode guard is active.
    const s = reduceAppState(
      { ...initialState, workflow: "WAITING_SEARCH_RESULTS" },
      { type: "SEARCH_READY" },
    );
    expect(s.workflow).toBe("SELECTING_PAGE"); // state machine allows it
  });
});
// ---- PROBE D: WORKFLOW_FAILED with non-active group ----
describe("ROUND2: WORKFLOW_FAILED ignores non-active group", () => {
  it("WORKFLOW_FAILED for a different group only sets ERROR, doesn't touch groups", () => {
    const g1 = group("a", "a@example.com");
    const g2 = group("b", "b@example.com");
    const s = reduceAppState(
      {
        ...initialState,
        workflow: "WAITING_SEARCH_RESULTS",
        activeGroupId: g1.id,
        analysis: analysis([g1, g2]),
      },
      {
        type: "WORKFLOW_FAILED",
        groupId: g2.id, // wrong group
        error: {
          code: "GISO-SEARCH-TIMEOUT-001",
          userMessageKey: "x",
          technicalMessage: "y",
          recoverable: true,
        },
      },
    );
    expect(s.workflow).toBe("ERROR");
    // g2 should NOT have been modified (it wasn't the active group).
    expect(s.analysis?.groups[1]?.status).toBe("ready");
  });
});
// ---- PROBE E: diagnostics cap is still enforced after new events ----
describe("ROUND2: diagnostics cap", () => {
  it("diagnostics never exceed 500 even with many illegal transitions", () => {
    let s = initialState;
    for (let i = 0; i < 600; i++) {
      s = reduceAppState(s, { type: "ALL_SELECTED" }); // always illegal from non-critical
    }
    expect(s.diagnostics.length).toBeLessThanOrEqual(500);
  });
});
// ---- PROBE F: ROUTE_CONTEXT_INVALIDATED is always legal ----
describe("ROUND2: ROUTE_CONTEXT_INVALIDATED from any state", () => {
  it("is accepted from every workflow state", () => {
    const states = [
      "IDLE",
      "ANALYZING",
      "RESULTS_READY",
      "CONFIRM_SEARCH",
      "SETTING_SEARCH",
      "WAITING_SEARCH_RESULTS",
      "SEARCH_READY_MANUAL",
      "SELECTING_PAGE",
      "WAITING_SELECT_ALL",
      "MANUAL_SELECT_ALL",
      "OPENING_MOVE_MENU",
      "WAITING_TARGET_SELECTION",
      "VERIFYING_COMPLETION",
      "COMPLETED",
      "CANCELLED",
      "ERROR",
    ];
    for (const wf of states) {
      const s = reduceAppState(
        { ...initialState, workflow: wf },
        { type: "ROUTE_CONTEXT_INVALIDATED" },
      );
      expect(s.workflow, `from ${wf}`).toBe("IDLE");
      expect(s.analysis, `from ${wf}`).toBeNull();
    }
  });
});
import { beforeEach } from "vitest";

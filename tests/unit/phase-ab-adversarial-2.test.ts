// ADVERSARIAL AUDIT 2: deeper probes on store acceptance, state machine edges,
// and the expectedRouteTransition flag. Assumes broken until proven.
import { describe, expect, it } from "vitest";
import { createStore } from "@/app/store";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
import { createAppController } from "@/app/controller";
import type { AppState } from "@/shared/types";

// Minimal acceptance fn matching the bootstrap's.
const acceptance = (s: AppState) => [
  s.workflow,
  s.activeGroupId,
  s.error?.code ?? "",
  s.analysis !== null,
  s.overlayVisible,
  s.expectedQuery ?? "",
  s.filter,
  s.sort,
];

describe("ADVERSARIAL 2: store acceptance edge cases", () => {
  it("SET_FILTER is accepted (filter changes)", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    expect(store.dispatch({ type: "SET_FILTER", value: "x" }).accepted).toBe(true);
    expect(store.getState().filter).toBe("x");
  });

  it("SET_FILTER with same value is NOT accepted (no real change)", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    store.dispatch({ type: "SET_FILTER", value: "x" });
    const r = store.dispatch({ type: "SET_FILTER", value: "x" });
    // ITI-043: the reducer returns the same state reference for an unchanged
    // filter, so stateChanged is false and accepted must be false.
    expect(r.accepted).toBe(false);
  });

  it("TOGGLE_OVERLAY when invisible is accepted", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    expect(store.dispatch({ type: "TOGGLE_OVERLAY" }).accepted).toBe(true);
    expect(store.getState().overlayVisible).toBe(true);
  });

  it("illegal transition produces accepted=false but still logs diagnostic", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    const r = store.dispatch({ type: "ALL_SELECTED" });
    expect(r.accepted).toBe(false);
    expect(store.getState().workflow).toBe("IDLE"); // unchanged
    expect(store.getState().diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });

  it("SHOW_OVERLAY when already visible is NOT accepted", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    store.dispatch({ type: "SHOW_OVERLAY" });
    const r = store.dispatch({ type: "SHOW_OVERLAY" });
    expect(r.accepted).toBe(false);
  });
});

describe("ADVERSARIAL 2: expectedRouteTransition isolation", () => {
  it("invalidateOnRouteChange during IDLE is a safe no-op (no crash)", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    const c = createAppController(store);
    expect(() => {
      c.invalidateOnRouteChange();
    }).not.toThrow();
    // IDLE -> ROUTE_CONTEXT_INVALIDATED resets to IDLE (no-op effectively).
    expect(store.getState().workflow).toBe("IDLE");
    c.dispose();
  });

  it("invalidateOnRouteChange after RESULTS_READY clears analysis", () => {
    const store = createStore(initialState, reduceAppState, acceptance);
    const c = createAppController(store);
    // Drive to RESULTS_READY via direct dispatch.
    store.dispatch({ type: "START_ANALYSIS" });
    store.dispatch({
      type: "ANALYSIS_SUCCEEDED",
      result: {
        startedAt: 0,
        completedAt: 0,
        sourceRoute: { accountSlot: 0, view: "inbox", fingerprint: "fp" },
        rowCount: 2,
        resolvedCount: 2,
        unresolvedCount: 0,
        duplicateCount: 0,
        weakFingerprintCount: 0,
        groups: [
          {
            id: "sender:a@example.com",
            normalizedEmail: "a@example.com",
            displayNames: ["A"],
            primaryDisplayName: "A",
            visibleEntryCount: 2,
            sourceFingerprints: ["f1", "f2"],
            confidence: "high",
            status: "ready",
          },
        ],
        unresolvedEntries: [],
      },
    });
    expect(store.getState().analysis).not.toBeNull();
    c.invalidateOnRouteChange();
    expect(store.getState().analysis).toBeNull();
    expect(store.getState().workflow).toBe("IDLE");
    c.dispose();
  });
});

describe("ADVERSARIAL 2: SEARCH_READY_MANUAL cannot reach auto-click states", () => {
  it("from SEARCH_READY_MANUAL, PAGE_SELECTED is illegal", () => {
    const s = reduceAppState(
      { ...initialState, workflow: "SEARCH_READY_MANUAL" as const },
      { type: "PAGE_SELECTED" },
    );
    expect(s.workflow).toBe("SEARCH_READY_MANUAL");
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });

  it("from SEARCH_READY_MANUAL, ALL_SELECTED is illegal", () => {
    const s = reduceAppState(
      { ...initialState, workflow: "SEARCH_READY_MANUAL" as const },
      { type: "ALL_SELECTED" },
    );
    expect(s.workflow).toBe("SEARCH_READY_MANUAL");
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });

  it("from SEARCH_READY_MANUAL, MOVE_MENU_OPENED is illegal", () => {
    const s = reduceAppState(
      { ...initialState, workflow: "SEARCH_READY_MANUAL" as const },
      { type: "MOVE_MENU_OPENED" },
    );
    expect(s.workflow).toBe("SEARCH_READY_MANUAL");
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
});

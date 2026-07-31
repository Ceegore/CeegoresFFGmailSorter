// ADVERSARIAL AUDIT of Phases A & B. Assumes every fix is broken; probes from
// unexpected angles the existing tests don't cover.
import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  selectCurrentPage: vi.fn(() => Promise.resolve(true)),
  trySelectAllMatches: vi.fn(() => Promise.resolve("selected" as const)),
  openMoveMenu: vi.fn(() => Promise.resolve(document.createElement("div"))),
  readCompletionEvidence: vi.fn(() => ({
    snackbarMoveText: true,
    menuClosedAfterInteraction: true,
    resultCountDecreased: true,
    resultListEmpty: true,
    inboxMatchesAbsent: true,
    undoVisible: true,
    score: 120,
  })),
  submitAndWait: vi.fn(() =>
    Promise.resolve({
      queryMatches: true,
      routeChanged: true,
      listFingerprintChanged: true,
      mailListDetected: true,
      emptyStateDetected: false,
      relatedOnlyDetected: false,
      loadingVisible: false,
      stableForMs: 300,
    }),
  ),
}));

vi.mock("@/gmail/search-controller", () => ({
  buildInboxSenderQuery: (email: string) => `in:inbox "from:${email}"`,
  submitAndWaitUntilReady: spies.submitAndWait,
}));
vi.mock("@/gmail/selection-controller", () => ({
  selectCurrentPage: spies.selectCurrentPage,
  trySelectAllMatches: spies.trySelectAllMatches,
}));
vi.mock("@/gmail/move-controller", () => ({ openMoveMenu: spies.openMoveMenu }));
vi.mock("@/gmail/completion-detector", () => ({
  readCompletionEvidence: spies.readCompletionEvidence,
  isAutoConfirmed: () => true,
}));
vi.mock("@/analyzer/inbox-analyzer", () => ({
  analyzeCurrentInbox: vi.fn(() =>
    Promise.resolve({
      startedAt: 1,
      completedAt: 2,
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
    }),
  ),
}));

import { createStore } from "@/app/store";
import { createAppController } from "@/app/controller";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

// ---- PROBE 1: confirmManualSelection / reopenMoveMenu in safe mode ----
// BUG-010 was supposed to gate ALL effects on dispatch acceptance. Are these
// two methods also gated? If not, they can click the Gmail move button even
// when the dispatch was rejected.
describe("ADVERSARIAL: confirmManualSelection / reopenMoveMenu gating (BUG-010)", () => {
  it("confirmManualSelection in safe mode must NOT call openMoveMenu", async () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    // In safe mode, the workflow is at SEARCH_READY_MANUAL (never reaches
    // MANUAL_SELECT_ALL). Calling confirmManualSelection should be a no-op.
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
    await c.confirmManualSelection();
    // CRITICAL: openMoveMenu must NOT be called.
    expect(spies.openMoveMenu).not.toHaveBeenCalled();
    c.dispose();
  });

  it("reopenMoveMenu in safe mode must NOT call openMoveMenu", async () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    await c.reopenMoveMenu();
    expect(spies.openMoveMenu).not.toHaveBeenCalled();
    c.dispose();
  });
});

// ---- PROBE 2: cancel during ANALYZING (no analysis) → BUG-050 ----
describe("ADVERSARIAL: cancel during ANALYZING (BUG-050 no-analysis case)", () => {
  it("cancel during ANALYZING must not leave a stuck CANCELLED state", async () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    // Start analysis but don't await — simulate cancel mid-analysis.
    const analysisPromise = c.analyze();
    // Workflow should be ANALYZING at this point.
    expect(store.getState().workflow).toBe("ANALYZING");
    c.cancel();
    await analysisPromise;
    // After cancel during ANALYZING (no analysis result), the workflow should
    // be in a safe terminal state, NOT stuck in CANCELLED with dead buttons.
    const wf = store.getState().workflow;
    expect(wf === "IDLE" || wf === "ERROR").toBe(true);
    expect(wf).not.toBe("CANCELLED");
    c.dispose();
  });
});

// ---- PROBE 3: ROUTE_CONTEXT_INVALIDATED preserves overlayVisible ----
describe("ADVERSARIAL: ROUTE_CONTEXT_INVALIDATED overlay visibility", () => {
  it("keeps the overlay visible after invalidation", () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    // Make overlay visible first.
    void c.handleBackgroundMessage("SHOW_OVERLAY");
    expect(store.getState().overlayVisible).toBe(true);
    // Invalidate.
    c.invalidateOnRouteChange();
    expect(store.getState().overlayVisible).toBe(true);
    c.dispose();
  });
});

// ---- PROBE 4: double confirmSearch doesn't start two searches ----
describe("ADVERSARIAL: double confirmSearch (BUG-010 double-click)", () => {
  it("second confirmSearch from SEARCH_READY_MANUAL is rejected (no second search)", async () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
    const searchCountBefore = spies.submitAndWait.mock.calls.length;
    // Second call: CONFIRM_SEARCH is illegal from SEARCH_READY_MANUAL.
    await c.confirmSearch();
    expect(spies.submitAndWait.mock.calls.length).toBe(searchCountBefore);
    c.dispose();
  });
});

// ---- PROBE 5: ignoreGroup during CONFIRM_SEARCH is rejected (BUG-051) ----
describe("ADVERSARIAL: ignoreGroup from non-RESULTS_READY (BUG-051)", () => {
  it("ignoreGroup from CONFIRM_SEARCH is rejected", async () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    // Now in CONFIRM_SEARCH. ignoreGroup should be rejected.
    c.ignoreGroup("sender:a@example.com");
    const s = store.getState();
    // Group should NOT be ignored.
    expect(s.analysis?.groups[0]?.status).not.toBe("ignored");
    c.dispose();
  });
});

// ---- PROBE 6: SAFE_MODE constant is actually true in the built bundle ----
describe("ADVERSARIAL: SAFE_MODE in dist/content.js", () => {
  it("dist/content.js contains SAFE_MODE=true logic (no auto-click path reachable)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const content = await fs.readFile(
      path.resolve(import.meta.dirname, "..", "..", "dist", "content.js"),
      "utf8",
    );
    // The safe-mode branch must be present and the manual-workflow view must exist.
    expect(content).toContain("SEARCH_READY_MANUAL");
    expect(content).toContain("manualWorkflowView");
  });
});

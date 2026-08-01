// Phase A safe-mode tests: prove the workflow performs ZERO automatic Gmail
// clicks. The Gmail controllers (selection/move/completion) must never be
// invoked while SAFE_MODE is on; the workflow stops at SEARCH_READY_MANUAL.
import { beforeEach, describe, expect, it, vi } from "vitest";
// Hoist-safe mock stores: vi.mock factories run before top-level consts, so we
// expose the spies via a shared object accessed inside the factories.
const spies = vi.hoisted(() => ({
  selectCurrentPage: vi.fn(() => Promise.resolve(true)),
  trySelectAllMatches: vi.fn(() => Promise.resolve("selected")),
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
}));
vi.mock("@/gmail/search-controller", () => ({
  buildInboxSenderQuery: (email) => `in:inbox "from:${email}"`,
  submitAndWaitUntilReady: vi.fn(() =>
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
import { SAFE_MODE } from "@/shared/constants";
beforeEach(() => {
  spies.selectCurrentPage.mockClear();
  spies.trySelectAllMatches.mockClear();
  spies.openMoveMenu.mockClear();
  spies.readCompletionEvidence.mockClear();
  document.body.innerHTML = "";
});
describe("Phase A safe mode", () => {
  it("SAFE_MODE is on", () => {
    expect(SAFE_MODE).toBe(true);
  });
  it("confirmSearch stops at SEARCH_READY_MANUAL and never calls selection/move/completion", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
    // CRITICAL: no automatic Gmail clicks happened.
    expect(spies.selectCurrentPage).not.toHaveBeenCalled();
    expect(spies.trySelectAllMatches).not.toHaveBeenCalled();
    expect(spies.openMoveMenu).not.toHaveBeenCalled();
    expect(spies.readCompletionEvidence).not.toHaveBeenCalled();
    c.dispose();
  });
  it("the query is surfaced for manual use", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    expect(store.getState().expectedQuery).toBe('in:inbox "from:a@example.com"');
    c.dispose();
  });
  it("manual mark-done completes the group and returns to results", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    c.confirmCompletion();
    expect(store.getState().workflow).toBe("RESULTS_READY");
    expect(store.getState().analysis?.groups[0]?.status).toBe("done");
    c.dispose();
  });
});

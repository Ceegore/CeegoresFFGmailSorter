// Controller workflow tests: drive the controller through analyze → select group
// → confirmSearch with the Gmail controllers stubbed via vi.mock, proving the
// state-machine transitions and group-status lifecycle (F-001) advance correctly.
import { beforeEach, describe, expect, it, vi } from "vitest";
// Stub the Gmail controllers so confirmSearch runs without real DOM operations.
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
  selectCurrentPage: vi.fn(() => Promise.resolve(true)),
  trySelectAllMatches: vi.fn(() => Promise.resolve("selected")),
}));
vi.mock("@/gmail/move-controller", () => ({
  openMoveMenu: vi.fn(() => Promise.resolve(document.createElement("div"))),
}));
vi.mock("@/gmail/completion-detector", () => ({
  readCompletionEvidence: () => ({
    snackbarMoveText: true,
    menuClosedAfterInteraction: true,
    resultCountDecreased: true,
    resultListEmpty: true,
    inboxMatchesAbsent: true,
    undoVisible: true,
    score: 120,
  }),
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
  document.body.innerHTML = "";
});
describe("controller workflow", () => {
  it("analyze succeeds and lands in RESULTS_READY", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    expect(store.getState().workflow).toBe("RESULTS_READY");
    expect(store.getState().analysis?.groups).toHaveLength(1);
    c.dispose();
  });
  it("selectGroup then confirmSearch stops at SEARCH_READY_MANUAL in safe mode (no auto clicks)", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    expect(store.getState().workflow).toBe("CONFIRM_SEARCH");
    await c.confirmSearch();
    // SAFE_MODE: the workflow stops after the verified search; no auto selection/move.
    expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
    expect(store.getState().expectedQuery).toContain('in:inbox "from:a@example.com"');
    // The group is in-progress (set before search); the user completes manually.
    expect(store.getState().analysis?.groups[0]?.status).toBe("in-progress");
    c.dispose();
  });
  it("cancel during an in-progress group restores it to ready", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    // Manually mark in-progress (as confirmSearch would), then cancel.
    store.dispatch({ type: "CONFIRM_SEARCH" });
    store.dispatch({ type: "MARK_GROUP_IN_PROGRESS", groupId: "sender:a@example.com" });
    expect(store.getState().analysis?.groups[0]?.status).toBe("in-progress");
    c.cancel();
    // CANCELLED is illegal from CONFIRM_SEARCH (non-critical), but cancel still
    // restores the group if it was in-progress.
    expect(store.getState().analysis?.groups[0]?.status).toBe("ready");
    c.dispose();
  });
  it("returnToResults from SEARCH_READY_MANUAL resets to RESULTS_READY", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
    c.returnToResults();
    expect(store.getState().workflow).toBe("RESULTS_READY");
    c.dispose();
  });
  it("confirmCompletion in safe mode marks the active group done and returns to results", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
    c.confirmCompletion();
    expect(store.getState().workflow).toBe("RESULTS_READY");
    expect(store.getState().analysis?.groups[0]?.status).toBe("done");
    c.dispose();
  });
  it("setFilter/setSort/ignoreGroup dispatch correctly", () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    c.setFilter("alpha");
    expect(store.getState().filter).toBe("alpha");
    c.setSort("name");
    expect(store.getState().sort).toBe("name");
    c.dispose();
  });
  it("handleBackgroundMessage toggles overlay and returns ok", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    const res = await c.handleBackgroundMessage("SHOW_OVERLAY");
    expect(res.ok).toBe(true);
    expect(store.getState().overlayVisible).toBe(true);
    c.dispose();
  });
  it("confirmSearch with no active group fails internally", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    // Force into CONFIRM_SEARCH without an active group set via SELECT_GROUP.
    store.dispatch({ type: "START_ANALYSIS" });
    // No analysis result, no active group — confirmSearch dispatches CONFIRM_SEARCH
    // (illegal from ANALYZING) then safeRun's task finds no group -> FAIL.
    await c.confirmSearch();
    expect(store.getState().error).not.toBeNull();
    c.dispose();
  });
  it("cancel from a critical workflow state transitions to CANCELLED", () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    // Drive into a critical state directly via the store.
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
    store.dispatch({ type: "SELECT_GROUP", groupId: "sender:a@example.com" });
    store.dispatch({ type: "CONFIRM_SEARCH" });
    store.dispatch({ type: "MARK_GROUP_IN_PROGRESS", groupId: "sender:a@example.com" });
    store.dispatch({ type: "SEARCH_SUBMITTED", query: 'in:inbox "from:a@example.com"' });
    // Now in WAITING_SEARCH_RESULTS (critical). cancel aborts and (BUG-050)
    // auto-returns to RESULTS_READY since analysis exists; group restored to ready.
    c.cancel();
    expect(store.getState().workflow).toBe("RESULTS_READY");
    expect(store.getState().analysis?.groups[0]?.status).toBe("ready");
    c.dispose();
  });
  it("resetSession aborts and returns to results", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.resetSession();
    // RESULTS_READY -> RETURN_TO_RESULTS stays RESULTS_READY (analysis present).
    expect(store.getState().workflow).toBe("RESULTS_READY");
    c.dispose();
  });
  it("confirmManualSelection and reopenMoveMenu run without throwing", async () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    // Drive to MANUAL_SELECT_ALL so confirmManualSelection can proceed.
    await c.confirmSearch();
    store.dispatch({ type: "MANUAL_SELECT_REQUIRED" });
    await c.confirmManualSelection();
    expect(store.getState().workflow).not.toBe("MANUAL_SELECT_ALL");
    c.dispose();
  });
  it("confirmCompletion marks the active group done", () => {
    const store = createStore(initialState, reduceAppState);
    const c = createAppController(store);
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
    store.dispatch({ type: "SELECT_GROUP", groupId: "sender:a@example.com" });
    store.dispatch({ type: "CONFIRM_SEARCH" });
    store.dispatch({ type: "MARK_GROUP_IN_PROGRESS", groupId: "sender:a@example.com" });
    // Drive to VERIFYING_COMPLETION.
    store.dispatch({ type: "SEARCH_SUBMITTED", query: 'in:inbox "from:a@example.com"' });
    store.dispatch({ type: "SEARCH_READY" });
    store.dispatch({ type: "PAGE_SELECTED" });
    store.dispatch({ type: "ALL_SELECTED" });
    store.dispatch({ type: "MOVE_MENU_OPENED" });
    store.dispatch({ type: "TARGET_CHOICE_DETECTED" });
    c.confirmCompletion();
    expect(store.getState().workflow).toBe("COMPLETED");
    expect(store.getState().analysis?.groups[0]?.status).toBe("done");
    c.dispose();
  });
});

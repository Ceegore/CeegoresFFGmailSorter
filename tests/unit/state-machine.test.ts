import { describe, expect, it } from "vitest";
import { reduceAppState, isCriticalWorkflow, deriveSteps } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
import { appError } from "@/shared/errors";
import type { AnalysisResult, SenderGroup } from "@/shared/types";

const group = (overrides: Partial<SenderGroup> = {}): SenderGroup => ({
  id: "sender:a@example.com",
  normalizedEmail: "a@example.com",
  displayNames: ["A"],
  primaryDisplayName: "A",
  visibleEntryCount: 2,
  sourceFingerprints: ["f1", "f2"],
  confidence: "high",
  status: "ready",
  ...overrides,
});

const analysis = (groups: SenderGroup[]): AnalysisResult => ({
  startedAt: 0,
  completedAt: 0,
  sourceRoute: { accountSlot: null, view: "inbox", fingerprint: "route-fp" },
  rowCount: groups.length,
  resolvedCount: groups.length,
  unresolvedCount: 0,
  duplicateCount: 0,
  weakFingerprintCount: 0,
  groups,
  unresolvedEntries: [],
});

describe("state machine", () => {
  it("rejects an illegal selection transition from idle", () => {
    const next = reduceAppState(initialState, { type: "ALL_SELECTED" });
    expect(next.workflow).toBe("IDLE");
    expect(next.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
  it("does not hide the overlay during a critical state", () => {
    const critical = {
      ...initialState,
      overlayVisible: true,
      workflow: "WAITING_SEARCH_RESULTS" as const,
    };
    expect(reduceAppState(critical, { type: "TOGGLE_OVERLAY" }).overlayVisible).toBe(true);
  });
  it("does not accept a free query before a valid active group exists", () => {
    expect(
      reduceAppState(initialState, {
        type: "SEARCH_SUBMITTED",
        query: 'in:inbox "from:a@example.com"',
      }).workflow,
    ).toBe("IDLE");
  });
  it("runs the full happy path to COMPLETED", () => {
    const withResults = {
      ...initialState,
      workflow: "RESULTS_READY" as const,
      analysis: analysis([group()]),
    };
    let s = reduceAppState(withResults, { type: "SELECT_GROUP", groupId: "sender:a@example.com" });
    s = reduceAppState(s, { type: "CONFIRM_SEARCH" });
    s = reduceAppState(s, { type: "SEARCH_SUBMITTED", query: 'in:inbox "from:a@example.com"' });
    s = reduceAppState(s, { type: "SEARCH_READY" });
    s = reduceAppState(s, { type: "PAGE_SELECTED" });
    s = reduceAppState(s, { type: "ALL_SELECTED" });
    s = reduceAppState(s, { type: "MOVE_MENU_OPENED" });
    s = reduceAppState(s, { type: "TARGET_CHOICE_DETECTED" });
    s = reduceAppState(s, { type: "COMPLETION_CONFIRMED" });
    expect(s.workflow).toBe("COMPLETED");
  });
  it("cancels from any critical workflow state", () => {
    for (const workflow of [
      "ANALYZING",
      "SETTING_SEARCH",
      "WAITING_SEARCH_RESULTS",
      "SELECTING_PAGE",
      "OPENING_MOVE_MENU",
    ] as const) {
      const s = reduceAppState({ ...initialState, workflow }, { type: "CANCELLED" });
      expect(s.workflow).toBe("CANCELLED");
    }
  });
  it("does not cancel from COMPLETED", () => {
    const s = reduceAppState({ ...initialState, workflow: "COMPLETED" }, { type: "CANCELLED" });
    expect(s.workflow).toBe("COMPLETED");
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
  it("FAIL is only allowed from ANALYZING or critical states", () => {
    const s = reduceAppState(initialState, {
      type: "FAIL",
      error: appError("GISO-INTERNAL-001", "x", "y", true),
    });
    expect(s.workflow).toBe("IDLE");
  });
  it("RETURN_TO_RESULTS lands on IDLE when no analysis exists", () => {
    const s = reduceAppState(
      { ...initialState, workflow: "ERROR", error: appError("GISO-INTERNAL-001", "x", "y", true) },
      { type: "RETURN_TO_RESULTS" },
    );
    expect(s.workflow).toBe("IDLE");
    expect(s.error).toBeNull();
  });
  it("MARK_GROUP_DONE flips a ready group to done", () => {
    const withResults = {
      ...initialState,
      workflow: "RESULTS_READY" as const,
      analysis: analysis([group({ status: "in-progress" })]),
    };
    const s = reduceAppState(withResults, {
      type: "MARK_GROUP_DONE",
      groupId: "sender:a@example.com",
    });
    expect(s.analysis?.groups[0]?.status).toBe("done");
  });
  it("MARK_GROUP_IN_PROGRESS flips ready -> in-progress (fixes F-001)", () => {
    const withResults = {
      ...initialState,
      workflow: "RESULTS_READY" as const,
      analysis: analysis([group({ status: "ready" })]),
    };
    let s = reduceAppState(withResults, {
      type: "MARK_GROUP_IN_PROGRESS",
      groupId: "sender:a@example.com",
    });
    expect(s.analysis?.groups[0]?.status).toBe("in-progress");
    // Now MARK_GROUP_ERROR must succeed (previously rejected because not in-progress).
    s = reduceAppState(s, {
      type: "MARK_GROUP_ERROR",
      groupId: "sender:a@example.com",
      errorCode: "GISO-SELECT-ALL-001",
    });
    expect(s.analysis?.groups[0]?.status).toBe("error");
    expect(s.analysis?.groups[0]?.lastErrorCode).toBe("GISO-SELECT-ALL-001");
  });
  it("MARK_GROUP_IN_PROGRESS only works from ready", () => {
    const withResults = {
      ...initialState,
      workflow: "RESULTS_READY" as const,
      analysis: analysis([group({ status: "done" })]),
    };
    const s = reduceAppState(withResults, {
      type: "MARK_GROUP_IN_PROGRESS",
      groupId: "sender:a@example.com",
    });
    expect(s.analysis?.groups[0]?.status).toBe("done");
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
});

describe("isCriticalWorkflow", () => {
  it("treats IDLE and RESULTS_READY as non-critical", () => {
    expect(isCriticalWorkflow("IDLE")).toBe(false);
    expect(isCriticalWorkflow("RESULTS_READY")).toBe(false);
  });
  it("treats WAITING_SEARCH_RESULTS as critical", () => {
    expect(isCriticalWorkflow("WAITING_SEARCH_RESULTS")).toBe(true);
  });
});

describe("deriveSteps", () => {
  it("marks the search step active during SETTING_SEARCH and marks MANUAL_SELECT_ALL as help", () => {
    const setting = deriveSteps("SETTING_SEARCH");
    expect(setting.search).toBe("active");
    expect(setting["select-page"]).toBe("pending");
    const manual = deriveSteps("MANUAL_SELECT_ALL");
    expect(manual["select-all"]).toBe("help");
  });
  it("marks all done at COMPLETED", () => {
    const done = deriveSteps("COMPLETED");
    expect(Object.values(done).every((v) => v === "done")).toBe(true);
  });
});

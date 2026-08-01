// Phase B state & route security tests: prove the fixed behaviors.
import { describe, expect, it, vi } from "vitest";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
import { createStore } from "@/app/store";
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
  sourceRoute: { accountSlot: 0, view: "inbox", fingerprint: "fp" },
  rowCount: groups.length,
  resolvedCount: groups.length,
  unresolvedCount: 0,
  duplicateCount: 0,
  weakFingerprintCount: 0,
  groups,
  unresolvedEntries: [],
});

describe("BUG-040: START_ANALYSIS clears old analysis", () => {
  it("removes analysis immediately on START_ANALYSIS", () => {
    const withOld = {
      ...initialState,
      workflow: "RESULTS_READY" as const,
      analysis: analysis([group()]),
    };
    const s = reduceAppState(withOld, { type: "START_ANALYSIS" });
    expect(s.workflow).toBe("ANALYZING");
    expect(s.analysis).toBeNull();
  });
});

describe("BUG-004: ROUTE_CONTEXT_INVALIDATED resets to IDLE", () => {
  it("discards analysis, active group, query, error", () => {
    const busy = {
      ...initialState,
      workflow: "WAITING_SEARCH_RESULTS" as const,
      analysis: analysis([group()]),
      activeGroupId: "sender:a@example.com",
      expectedQuery: 'in:inbox has:nouserlabels "from:a@example.com"',
      error: appError("GISO-INTERNAL-001", "internal", "x", true),
    };
    const s = reduceAppState(busy, { type: "ROUTE_CONTEXT_INVALIDATED" });
    expect(s.workflow).toBe("IDLE");
    expect(s.analysis).toBeNull();
    expect(s.activeGroupId).toBeNull();
    expect(s.expectedQuery).toBeNull();
    expect(s.error).toBeNull();
  });
});

describe("BUG-008: WORKFLOW_FAILED marks the active group error", () => {
  it("sets the active group to error and workflow to ERROR", () => {
    const busy = {
      ...initialState,
      workflow: "WAITING_SEARCH_RESULTS" as const,
      activeGroupId: "sender:a@example.com",
      analysis: analysis([group({ status: "in-progress" as const })]),
    };
    const s = reduceAppState(busy, {
      type: "WORKFLOW_FAILED",
      groupId: "sender:a@example.com",
      error: appError("GISO-SEARCH-TIMEOUT-001", "searchFailed", "timeout", true),
    });
    expect(s.workflow).toBe("ERROR");
    expect(s.analysis?.groups[0]?.status).toBe("error");
    expect(s.analysis?.groups[0]?.lastErrorCode).toBe("GISO-SEARCH-TIMEOUT-001");
  });
});

describe("BUG-051: group-status events bound to active group", () => {
  it("MARK_GROUP_DONE on a non-active group is illegal", () => {
    const s = reduceAppState(
      {
        ...initialState,
        workflow: "RESULTS_READY" as const,
        activeGroupId: "sender:a@example.com",
        analysis: analysis([group({ id: "sender:b@example.com", status: "in-progress" as const })]),
      },
      { type: "MARK_GROUP_DONE", groupId: "sender:b@example.com" },
    );
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
  it("IGNORE_GROUP only legal from RESULTS_READY", () => {
    const s = reduceAppState(
      { ...initialState, workflow: "IDLE" as const, analysis: analysis([group()]) },
      { type: "IGNORE_GROUP", groupId: "sender:a@example.com" },
    );
    expect(s.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
});

describe("BUG-010: dispatch returns accepted", () => {
  it("legal transition accepted=true", () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    expect(store.dispatch({ type: "START_ANALYSIS" }).accepted).toBe(true);
  });
  it("illegal transition accepted=false (diagnostic only)", () => {
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    expect(store.dispatch({ type: "ALL_SELECTED" }).accepted).toBe(false);
  });
});

describe("BUG-036: abort does not trigger a retry click", () => {
  it("submitAndWaitUntilReady rethrows AbortError without retrying", async () => {
    // We test the catch logic indirectly: an aborted signal must not produce a
    // second button click. Mock the search DOM minimally.
    document.body.innerHTML = "";
    const form = document.createElement("form");
    const box = document.createElement("input");
    box.type = "text";
    box.setAttribute("aria-label", "Suche");
    box.value = 'in:inbox "from:a@example.com"';
    const btn = document.createElement("button");
    btn.type = "submit";
    btn.setAttribute("aria-label", "Suche");
    const clickSpy = vi.fn();
    btn.addEventListener("click", clickSpy);
    form.append(box, btn);
    document.body.append(form);

    const { submitAndWaitUntilReady } = await import("@/gmail/search-controller");
    const ac = new AbortController();
    ac.abort();
    await expect(
      submitAndWaitUntilReady('in:inbox "from:a@example.com"', ac.signal, {
        timeoutMs: 500,
        stabilityMs: 50,
      }),
    ).rejects.toThrow();
    // The retry path would click the button again on timeout; an abort must NOT.
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

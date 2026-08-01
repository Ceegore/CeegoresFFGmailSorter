// QA section 11 — minimum regression tests for the bugs fixed in the current
// safe-mode remediation pass (ITI-001/002/003/005/006/011/014/015). Each test
// pins one specific defect so a reintroduction fails loudly. The controller-
// driven tests reuse the mocking pattern from controller-workflow.test.ts and
// safe-mode.test.ts: Gmail controllers are stubbed via vi.mock with hoisted
// spies so per-test behavior (success vs timeout) can be configured.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted spies shared across the vi.mock factories below. submitAndWaitUntilReady
// is configured per test (success / timeout / etc.) via mockImplementation.
const spies = vi.hoisted(() => ({
  submitAndWaitUntilReady: vi.fn(),
}));

vi.mock("@/gmail/search-controller", () => ({
  buildInboxSenderQuery: (email: string) => `in:inbox "from:${email}"`,
  submitAndWaitUntilReady: spies.submitAndWaitUntilReady,
}));
vi.mock("@/gmail/selection-controller", () => ({
  selectCurrentPage: vi.fn(() => Promise.resolve(true)),
  trySelectAllMatches: vi.fn(() => Promise.resolve("selected" as const)),
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

import { createProductionStore } from "../helpers/production-store";
import { createAppController } from "@/app/controller";
import { GisoError, appError, toAppError } from "@/shared/errors";
import { extractSenderFromRow } from "@/analyzer/sender-extractor";
import { buildInboxSenderQuery } from "@/gmail/search-controller";
import { observeRoutes } from "@/gmail/route-observer";
import type { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";

/** Shape of the inbox-analyzer module (used to type vi.importActual). */
interface AnalyzeCurrentInboxModule {
  analyzeCurrentInbox: typeof analyzeCurrentInbox;
}

const GROUP_ID = "sender:a@example.com";

/** Default resolving evidence returned by the mocked search controller. */
function readyEvidence() {
  return {
    queryMatches: true,
    routeChanged: true,
    listFingerprintChanged: true,
    mailListDetected: true,
    emptyStateDetected: false,
    relatedOnlyDetected: false,
    loadingVisible: false,
    stableForMs: 300,
  };
}

/** A standard analysis result with one ready group, used by the controller mock. */
function singleGroupResult() {
  return {
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
        id: GROUP_ID,
        normalizedEmail: "a@example.com",
        displayNames: ["A"],
        primaryDisplayName: "A",
        visibleEntryCount: 2,
        sourceFingerprints: ["f1", "f2"],
        confidence: "high" as const,
        status: "ready" as const,
      },
    ],
    unresolvedEntries: [],
  };
}

/**
 * The controller-driven tests (ITI-001/002/003/005) drive analyze() through the
 * controller's real effect, which dispatches ANALYSIS_SUCCEEDED with whatever
 * the analyzer returns. We stub analyzeCurrentInbox to resolve our synthetic
 * single-group result so those tests stay independent of Gmail DOM detection.
 * The ITI-014 test, which exercises the REAL selection-conflict path, bypasses
 * the controller and imports the real analyzer via vi.importActual.
 */
vi.mock("@/analyzer/inbox-analyzer", () => ({
  analyzeCurrentInbox: vi.fn(() => Promise.resolve(singleGroupResult())),
}));

/** Build a store+controller pair primed to the SEARCH_READY_MANUAL state. */
async function driveToSearchReadyManual() {
  const store = createProductionStore();
  const c = createAppController(store);
  spies.submitAndWaitUntilReady.mockImplementation(() => Promise.resolve(readyEvidence()));
  await c.analyze();
  c.selectGroup(GROUP_ID);
  await c.confirmSearch();
  return { store, c };
}

beforeEach(() => {
  document.body.innerHTML = "";
  spies.submitAndWaitUntilReady.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QA section 11 — safe-mode regression tests", () => {
  describe("ITI-001 — manual Back restores group to ready", () => {
    it("returnToResults from SEARCH_READY_MANUAL restores the group to ready (not in-progress)", async () => {
      const { store, c } = await driveToSearchReadyManual();
      expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
      c.returnToResults();
      expect(store.getState().workflow).toBe("RESULTS_READY");
      // The bug: the group was left in-progress after Back. It must be ready.
      expect(store.getState().analysis?.groups[0]?.status).toBe("ready");
      expect(store.getState().analysis?.groups[0]?.status).not.toBe("in-progress");
      c.dispose();
    });
  });

  describe("ITI-002 — search timeout marks the group error (not in-progress)", () => {
    it("a GISO-SEARCH-TIMEOUT-001 failure marks the active group error", async () => {
      spies.submitAndWaitUntilReady.mockImplementation(() => {
        // Wrap the timeout in a structured GisoError exactly as the real
        // search-controller does (GISO-SEARCH-TIMEOUT-001 is recoverable).
        throw new GisoError(
          appError("GISO-SEARCH-TIMEOUT-001", "searchFailed", "search timed out", true),
        );
      });
      const store = createProductionStore();
      const c = createAppController(store);
      await c.analyze();
      c.selectGroup(GROUP_ID);
      await c.confirmSearch();
      // The workflow must be ERROR, not stranded in a critical/in-progress state.
      expect(store.getState().workflow).toBe("ERROR");
      // The group must be "error" — never left "in-progress".
      expect(store.getState().analysis?.groups[0]?.status).toBe("error");
      expect(store.getState().analysis?.groups[0]?.status).not.toBe("in-progress");
      c.dispose();
    });
  });

  describe("ITI-003 — error group can be retried", () => {
    it("restoreGroup from RESULTS_READY returns an errored group to ready status", async () => {
      const { store, c } = await driveToSearchReadyManual();
      // The group is in-progress here (set before the search). Mark it error
      // while still in SEARCH_READY_MANUAL, where MARK_GROUP_ERROR is legal.
      store.dispatch({
        type: "MARK_GROUP_ERROR",
        groupId: GROUP_ID,
        errorCode: "GISO-SEARCH-TIMEOUT-001",
      });
      expect(store.getState().analysis?.groups[0]?.status).toBe("error");
      // Return to the results list. restoreActiveGroupToReady only touches
      // in-progress groups, so the errored group is preserved and activeGroupId
      // is cleared — this is exactly the state the real retry button renders in.
      c.returnToResults();
      expect(store.getState().workflow).toBe("RESULTS_READY");
      expect(store.getState().activeGroupId).toBeNull();
      expect(store.getState().analysis?.groups[0]?.status).toBe("error");
      // ITI-003: the retry path (rendered in RESULTS_READY, no active group)
      // restores the errored group so it can be actioned again.
      c.restoreGroup(GROUP_ID);
      expect(store.getState().analysis?.groups[0]?.status).toBe("ready");
      c.dispose();
    });
  });

  describe("ITI-011 — query is spec-compliant (no has:nouserlabels)", () => {
    it("buildInboxSenderQuery yields the exact inbox+from query", () => {
      // The bug: the query used to include `has:nouserlabels`, which is not in
      // the locked spec query (§53.2). The fixed builder produces only
      // `in:inbox "from:<email>"`.
      expect(buildInboxSenderQuery("news@example.com")).toBe('in:inbox "from:news@example.com"');
    });
  });

  describe("ITI-014 — existing Gmail selection blocks analysis", () => {
    // This exercises the REAL analyzeCurrentInbox selection-conflict path. The
    // module-level vi.mock above overrides analyzeCurrentInbox for the
    // controller-driven tests, so here we import the genuine implementation via
    // vi.importActual. The DOM + location are configured like the integration
    // fixture so shell/view detection pass and the selection check is reached.
    function installGmailInboxDom() {
      const state = {
        hash: "#inbox",
        pathname: "/mail/u/0/",
        hostname: "mail.google.com",
        search: "",
        get href(): string {
          return `https://${state.hostname}${state.pathname}${state.hash}`;
        },
      };
      Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: state,
      });
      // Minimal Gmail-like shell: a [role="main"] with an inbox nav link marked
      // active, plus a message list with at least one row-like child.
      const nav = document.createElement("nav");
      const inboxLink = document.createElement("a");
      inboxLink.setAttribute("href", "#inbox");
      inboxLink.setAttribute("aria-current", "page");
      inboxLink.textContent = "Posteingang";
      nav.append(inboxLink);
      const main = document.createElement("div");
      main.setAttribute("role", "main");
      const grid = document.createElement("table");
      grid.setAttribute("role", "grid");
      const tbody = document.createElement("tbody");
      const row = document.createElement("tr");
      row.setAttribute("role", "row");
      // A sender attribute + an opener so looksLikeMessageRow() accepts it.
      row.setAttribute("email", "news@example.com");
      const opener = document.createElement("a");
      opener.setAttribute("href", "#thread/1");
      row.append(opener);
      tbody.append(row);
      grid.append(tbody);
      main.append(grid);
      document.body.append(nav, main);
    }

    it("analyzeCurrentInbox throws GISO-SELECTION-CONFLICT-001 when a checkbox is checked", async () => {
      const real = await vi.importActual<AnalyzeCurrentInboxModule>("@/analyzer/inbox-analyzer");
      document.body.innerHTML = "";
      installGmailInboxDom();
      // CUR-018: the selection guard is scoped to [role="main"], where Gmail
      // renders its message-list checkboxes. Append the checked checkbox inside
      // the main mail surface (created by installGmailInboxDom) so the guard
      // correctly trips while selections outside the overlay/main are ignored.
      const checked = document.createElement("div");
      checked.setAttribute("role", "checkbox");
      checked.setAttribute("aria-checked", "true");
      document.querySelector('[role="main"]')?.append(checked);

      const err = await real
        .analyzeCurrentInbox(new AbortController().signal)
        .catch((e: unknown) => e);
      expect(toAppError(err).code).toBe("GISO-SELECTION-CONFLICT-001");
    });
  });

  describe("ITI-015 — multi-participant thread is an unresolved conflict", () => {
    it("a row with two distinct sender elements resolves to confidence 'unresolved'", () => {
      const row = document.createElement("div");
      const first = document.createElement("span");
      first.setAttribute("email", "alice@example.com");
      first.textContent = "Alice";
      const second = document.createElement("span");
      second.setAttribute("email", "bob@example.com");
      second.textContent = "Bob";
      row.append(first, second);
      document.body.append(row);

      const sender = extractSenderFromRow(row);
      // The bug: only the first [email] was read, misattributing the thread to a
      // single participant. The fix reads every [email] so the conflict guard
      // (uniqueEmails.size > 1) fires and the row is unresolved.
      expect(sender.confidence).toBe("unresolved");
      expect(sender.diagnostics).toContain("GISO-SENDER-CONFLICT-001");
    });
  });

  describe("ITI-005 — route grace period prevents self-invalidation", () => {
    it("invalidateOnRouteChange during the grace window is a no-op", async () => {
      vi.useFakeTimers();
      const { store, c } = await driveToSearchReadyManual();
      // The controller arms a 3s grace window after the search resolves so that
      // the route-observer's debounced mutation (from Gmail applying the search)
      // cannot invalidate the session. We are inside that window here.
      expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
      // Advancing less than the 3s grace keeps us inside it.
      vi.advanceTimersByTime(1000);
      c.invalidateOnRouteChange();
      // No ROUTE_CONTEXT_INVALIDATED dispatched: workflow must be unchanged and
      // the analysis must still be present.
      expect(store.getState().workflow).toBe("SEARCH_READY_MANUAL");
      expect(store.getState().analysis).not.toBeNull();
      c.dispose();
    });

    it("invalidateOnRouteChange fires once the grace window has elapsed", async () => {
      vi.useFakeTimers();
      const { store, c } = await driveToSearchReadyManual();
      // After 3s+ the grace window has closed; a route change now invalidates.
      vi.advanceTimersByTime(4000);
      c.invalidateOnRouteChange();
      expect(store.getState().workflow).toBe("IDLE");
      expect(store.getState().analysis).toBeNull();
      c.dispose();
    });
  });

  describe("ITI-006 — hashchange fires immediately (not debounced)", () => {
    it("dispatching hashchange invokes the callback before any timer elapses", () => {
      vi.useFakeTimers();
      const cb = vi.fn();
      const loc = { href: "https://mail.google.com/#inbox" };
      Object.defineProperty(window, "location", {
        writable: true,
        configurable: true,
        value: loc,
      });
      const obs = observeRoutes(cb);
      loc.href = "https://mail.google.com/#search/from:x";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      // ITI-006: hashchange is processed immediately, not through the 150ms
      // mutation debounce.
      expect(cb).toHaveBeenCalledTimes(1);
      // Confirm the debounce does not double-fire later.
      vi.advanceTimersByTime(200);
      expect(cb).toHaveBeenCalledTimes(1);
      obs.dispose();
    });
  });
});

// Regression tests for the six retest-report fixes:
// 1. Evidence-driven search submission fallback chain (search-controller).
// 2. Analyzer deadline fail-safe (inbox-analyzer).
// 4. Same-account navigation masking during an in-flight search (controller).
// 5. Recipient matching word-boundary (sender-extractor).
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- shared location stub helper -------------------------------------------
function installLocation(
  hash = "#inbox",
  pathname = "/mail/u/0/",
): { setHash: (h: string) => void; setPathname: (p: string) => void } {
  const state = {
    hash,
    pathname,
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
  return {
    setHash(h: string): void {
      state.hash = h;
    },
    setPathname(p: string): void {
      state.pathname = p;
    },
  };
}

// ===========================================================================
// Fix #1: evidence-driven search submission fallback chain.
// The previous submitSearch() picked ONE method (button > form > Enter) and
// returned immediately; if the button was a no-op, the fallbacks were never
// tried. submitAndWaitUntilReady now drives the chain itself: it tries each
// method and probes for evidence (route/list change) between attempts.
// ===========================================================================
describe("Fix #1: evidence-driven search submission fallback chain", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  /**
   * Build a search landmark with a button, a form, and a box. The button is a
   * no-op (click does nothing); only the form's submit handler actually changes
   * the route so evidence can be seen. This proves the chain falls through from
   * the button to the form method.
   */
  function buildSearchDomWhereButtonIsNoopAndFormNavigates(): HTMLInputElement {
    const landmark = document.createElement("div");
    landmark.setAttribute("role", "search");
    const form = document.createElement("form");
    const box = document.createElement("input");
    box.type = "text";
    box.setAttribute("aria-label", "Suche");
    const button = document.createElement("button");
    button.type = "submit";
    button.setAttribute("aria-label", "Suche");
    button.textContent = "Suche";
    form.append(box, button);
    landmark.append(form);
    document.body.append(landmark);
    // The real submit button is a no-op: clicking it must NOT navigate.
    // form.requestSubmit(), however, DOES navigate (installs the mail list).
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      // Simulate Gmail navigating to the search results.
      window.location.hash = "#search/from:x";
      const main = document.createElement("div");
      main.setAttribute("role", "main");
      const list = document.createElement("div");
      list.setAttribute("role", "list");
      const row = document.createElement("div");
      row.setAttribute("role", "listitem");
      row.setAttribute("data-thread-id", "r0");
      list.append(row);
      main.append(list);
      document.body.append(main);
    });
    return box;
  }

  it("falls through a no-op button to form.requestSubmit and resolves evidence", async () => {
    installLocation("#inbox");
    buildSearchDomWhereButtonIsNoopAndFormNavigates();
    const { submitAndWaitUntilReady } = await import("@/gmail/search-controller");
    const evidence = await submitAndWaitUntilReady(
      'in:inbox "from:x@example.com"',
      new AbortController().signal,
      { timeoutMs: 3000, stabilityMs: 50 },
    );
    expect(evidence.mailListDetected).toBe(true);
    expect(evidence.routeChanged).toBe(true);
  });

  it("throws when every submission method is a no-op and evidence never arrives", async () => {
    installLocation("#inbox");
    // No form, no button that navigates, no key handler: Enter won't trigger a
    // navigation either, so no evidence can ever appear. The chain must exhaust
    // all methods and the last-resort full-timeout wait, then throw.
    const landmark = document.createElement("div");
    landmark.setAttribute("role", "search");
    const box = document.createElement("input");
    box.type = "text";
    box.setAttribute("aria-label", "Suche");
    // A decoy button whose click does nothing (no form submission wired).
    const decoy = document.createElement("button");
    decoy.setAttribute("role", "button");
    decoy.setAttribute("aria-label", "Suche");
    decoy.textContent = "Suche";
    landmark.append(box, decoy);
    document.body.append(landmark);
    const { submitAndWaitUntilReady } = await import("@/gmail/search-controller");
    const promise = submitAndWaitUntilReady(
      'in:inbox "from:x@example.com"',
      new AbortController().signal,
      { timeoutMs: 400, stabilityMs: 30 },
    );
    await expect(promise).rejects.toMatchObject({
      app: { userMessageKey: "searchFailed" },
    });
  });

  it("does not retry via another method on a related-only hard failure", async () => {
    // CUR-002: a related-only result is a hard failure. The fallback chain must
    // surface GISO-SEARCH-RELATED-ONLY-001 immediately rather than walking to
    // the next submission method (retrying cannot change Gmail's result set).
    installLocation("#inbox");
    const landmark = document.createElement("div");
    landmark.setAttribute("role", "search");
    const form = document.createElement("form");
    const box = document.createElement("input");
    box.type = "text";
    box.setAttribute("aria-label", "Suche");
    const button = document.createElement("button");
    button.type = "submit";
    button.setAttribute("aria-label", "Suche");
    button.textContent = "Suche";
    form.append(box, button);
    landmark.append(form);
    document.body.append(landmark);
    // The button navigates to a search route AND shows a related-only banner.
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      window.location.hash = "#search/from:x";
      const main = document.createElement("div");
      main.setAttribute("role", "main");
      const banner = document.createElement("div");
      banner.setAttribute("role", "status");
      banner.textContent = "Ähnliche Ergebnisse";
      main.append(banner);
      document.body.append(main);
    });
    const { submitAndWaitUntilReady } = await import("@/gmail/search-controller");
    await expect(
      submitAndWaitUntilReady('in:inbox "from:x@example.com"', new AbortController().signal, {
        timeoutMs: 3000,
        stabilityMs: 50,
      }),
    ).rejects.toMatchObject({ app: { code: "GISO-SEARCH-RELATED-ONLY-001" } });
  });
});

// ===========================================================================
// Fix #2/#3 (analyzer stability fail-safe) lives in its own test file,
// analyzer-stability-failsafe.test.ts, because this file hoists a
// vi.mock("@/analyzer/inbox-analyzer") below for the controller tests, which
// would otherwise replace the real analyzer with the mock here too.
// ===========================================================================

// ===========================================================================
// Fix #4: same-account navigation masking during an in-flight search.
// During expectedRouteTransition, a route change is only "expected" if it is a
// transition TO a #search route (or the route hasn't changed yet). Any other
// same-account route change (label, thread, settings) must invalidate.
// We exercise this by mocking submitAndWaitUntilReady to call
// invalidateOnRouteChange from within the in-flight window.
// ===========================================================================
vi.mock("@/analyzer/inbox-analyzer", () => ({
  analyzeCurrentInbox: vi.fn(() =>
    Promise.resolve({
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
    }),
  ),
}));

describe("Fix #4: same-account navigation masking during in-flight search", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installLocation("#inbox");
  });

  /**
   * Drive confirmSearch with a mocked submitAndWaitUntilReady whose
   * implementation invokes onInFlight BEFORE resolving. This lets us observe
   * what invalidateOnRouteChange does while expectedRouteTransition is true.
   *
   * The mock receives the AbortSignal and rejects with an AbortError when the
   * signal is aborted — mirroring the real contract so that when
   * invalidateOnRouteChange aborts mid-search, confirmSearch's safeRun sees the
   * abort and does not proceed to SEARCH_READY_MANUAL.
   *
   * `onInFlight` receives both the active controller (so it can call
   * invalidateOnRouteChange) and the signal.
   */
  async function driveConfirmSearchWhileInFlight(
    onInFlight: (controller: { invalidateOnRouteChange: () => void }, signal: AbortSignal) => void,
  ): Promise<{ workflow: string; analysisNull: boolean }> {
    // Re-mock submitAndWaitUntilReady for this case only. The hook runs inside
    // the mock, so we capture the active controller via a holder created before
    // confirmSearch is called.
    const holder: { controller?: { invalidateOnRouteChange: () => void } } = {};
    vi.doMock("@/gmail/search-controller", () => ({
      buildInboxSenderQuery: (email: string) => `in:inbox "from:${email}"`,
      submitAndWaitUntilReady: vi.fn(
        (
          _query: string,
          signal: AbortSignal,
        ): Promise<{
          queryMatches: boolean;
          routeChanged: boolean;
          listFingerprintChanged: boolean;
          mailListDetected: boolean;
          emptyStateDetected: boolean;
          relatedOnlyDetected: boolean;
          loadingVisible: boolean;
          stableForMs: number;
        }> => {
          if (holder.controller) onInFlight(holder.controller, signal);
          if (signal.aborted) {
            return Promise.reject(new DOMException("Operation aborted", "AbortError"));
          }
          return Promise.resolve({
            queryMatches: true,
            routeChanged: true,
            listFingerprintChanged: true,
            mailListDetected: true,
            emptyStateDetected: false,
            relatedOnlyDetected: false,
            loadingVisible: false,
            stableForMs: 300,
          });
        },
      ),
    }));
    vi.resetModules();
    const { createAppController } = await import("@/app/controller");
    const { createProductionStore } = await import("../helpers/production-store");
    const store = createProductionStore();
    const c = createAppController(store);
    holder.controller = c;
    await c.analyze();
    c.selectGroup("sender:a@example.com");
    await c.confirmSearch();
    const state = store.getState();
    const result = { workflow: state.workflow, analysisNull: state.analysis === null };
    c.dispose();
    vi.doUnmock("@/gmail/search-controller");
    return result;
  }

  it("allows a same-account transition TO #search during the in-flight search", async () => {
    const loc = installLocation("#inbox");
    const result = await driveConfirmSearchWhileInFlight((c) => {
      // Gmail navigates to the search results route mid-search. This is the
      // expected transition, so invalidateOnRouteChange must NOT abort.
      loc.setHash("#search/from:a");
      c.invalidateOnRouteChange();
    });
    // Not invalidated: workflow reaches SEARCH_READY_MANUAL (safe mode), and
    // analysis is preserved.
    expect(result.workflow).toBe("SEARCH_READY_MANUAL");
    expect(result.analysisNull).toBe(false);
  });

  it("invalidates when a same-account route changes to a label mid-search", async () => {
    const loc = installLocation("#inbox");
    const result = await driveConfirmSearchWhileInFlight((c) => {
      // The user (or an unrelated navigation) moves to a label mid-search.
      loc.setHash("#label/work");
      // CUR-019 must invalidate despite the in-flight flag because a label is
      // not a #search transition.
      c.invalidateOnRouteChange();
    });
    // CUR-019: invalidated — analysis discarded, session reset to IDLE.
    expect(result.workflow).toBe("IDLE");
    expect(result.analysisNull).toBe(true);
  });

  it("invalidates when a same-account route changes to a thread mid-search", async () => {
    const loc = installLocation("#inbox");
    const result = await driveConfirmSearchWhileInFlight((c) => {
      loc.setHash("#inbox/thread123");
      c.invalidateOnRouteChange();
    });
    expect(result.workflow).toBe("IDLE");
    expect(result.analysisNull).toBe(true);
  });

  it("invalidates when the account slot changes mid-search even on a search route", async () => {
    // CUR-009/CUR-019: a switch to a different account is never expected, even
    // during the in-flight transition and even if the route looks like #search.
    const loc = installLocation("#inbox");
    const result = await driveConfirmSearchWhileInFlight((c) => {
      // Navigate to a search route BUT under a different account slot (/u/1/).
      loc.setPathname("/mail/u/1/");
      loc.setHash("#search/from:a");
      c.invalidateOnRouteChange();
    });
    expect(result.workflow).toBe("IDLE");
    expect(result.analysisNull).toBe(true);
  });

  it("does not invalidate when called during in-flight search before the route has changed", async () => {
    // CUR-019: while the search is in flight, invalidateOnRouteChange may fire
    // (e.g. a stray mutation) BEFORE Gmail has actually changed the route. In
    // that case the route still equals the pre-search route, so the call is a
    // no-op and the search must proceed.
    installLocation("#inbox"); // route stays at the pre-search route
    const result = await driveConfirmSearchWhileInFlight((c) => {
      c.invalidateOnRouteChange(); // route unchanged -> must NOT invalidate
    });
    expect(result.workflow).toBe("SEARCH_READY_MANUAL");
    expect(result.analysisNull).toBe(false);
  });
});

// ===========================================================================
// Fix #5: recipient matching word-boundary.
// [aria-label*="To" i] previously matched "Today"/"Toolbar". Using ~= (word
// match) requires "To" to be an exact whitespace-separated token.
// ===========================================================================
describe("Fix #5: recipient matching word-boundary (no false positive on 'Today')", () => {
  // extractSenderFromRow is the public entry; isInsideRecipientWidget is
  // private. We verify behavior end-to-end: an email-bearing span inside a
  // widget labelled "Today" must NOT be treated as a recipient widget, so its
  // email still counts as a sender source (no false exclusion).
  it("a 'Today'-labelled container does not mask a child sender email", async () => {
    const { extractSenderFromRow } = await import("@/analyzer/sender-extractor");
    const row = document.createElement("div");
    // A container labelled "Today" (substring "To") that wraps an email span.
    const todayBox = document.createElement("span");
    todayBox.setAttribute("aria-label", "Today");
    const emailSpan = document.createElement("span");
    emailSpan.setAttribute("email", "news@example.com");
    todayBox.append(emailSpan);
    row.append(todayBox);
    document.body.append(row);
    const s = extractSenderFromRow(row);
    // CUR-022: because "Today" no longer matches the recipient selector, the
    // email span is NOT excluded and resolves cleanly.
    expect(s.normalizedEmail).toBe("news@example.com");
    expect(s.confidence).toBe("high");
  });

  it("an actual 'To' recipient label still masks its child email (no false sender)", async () => {
    const { extractSenderFromRow } = await import("@/analyzer/sender-extractor");
    const row = document.createElement("div");
    // A genuine recipient widget: aria-label contains the word "To" as a
    // standalone whitespace-separated token (word-match ~= matches this).
    const toBox = document.createElement("span");
    toBox.setAttribute("aria-label", "To carol@example.com");
    const emailSpan = document.createElement("span");
    emailSpan.setAttribute("email", "carol@example.com");
    toBox.append(emailSpan);
    // A real sender element outside the recipient widget.
    const senderSpan = document.createElement("span");
    senderSpan.setAttribute("email", "sender@example.com");
    row.append(toBox, senderSpan);
    document.body.append(row);
    const s = extractSenderFromRow(row);
    // Only the real sender remains; the recipient's email is excluded so it
    // does not create a conflict.
    expect(s.normalizedEmail).toBe("sender@example.com");
  });
});

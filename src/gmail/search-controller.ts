// Gmail search controller (spec §53). Builds the locked quoted query, sets it
// via the native input setter, submits through the native search button (with
// form.requestSubmit and Enter as fallbacks), and waits for the ready-evidence
// model. Never searches via URL or internal RPC.
import { normalizeEmail } from "@/analyzer/email-parser";
import { assertNotAborted } from "@/shared/abort";
import { delay } from "@/shared/time";
import { gmailTextPatterns, matchesAny } from "@/gmail/gmail-text-patterns";
import { detectAccountSlot, findMessageListElement } from "@/gmail/dom-detectors";
import { isInteractable } from "@/shared/dom";
import { appError, throwAppError } from "@/shared/errors";

export function buildInboxSenderQuery(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized.ok) throw new Error(`Invalid sender email: ${normalized.error}`);
  return `in:inbox "from:${normalized.value}"`;
}

export function normalizeQueryForComparison(value: string): string {
  return value.normalize("NFKC").replace(/[“”]/gu, '"').replace(/\s+/gu, " ").trim().toLowerCase();
}

/** Native value setter that React-style inputs can observe (spec §53.3, §15.1). */
export function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (!descriptor?.set) throw new Error("Native input setter unavailable");
  descriptor.set.call(input, value);
  input.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }),
  );
  input.dispatchEvent(new Event("change", { bubbles: true }));
  if (input.value !== value) throw new Error("Search input did not accept the expected query");
}

export function findSearchBox(): HTMLInputElement | null {
  // ITI-008: Prefer the search box inside a [role="search"] landmark (Gmail's
  // main search). This avoids matching Chat/Spaces/Contacts search controls
  // that live elsewhere in the document.
  // CUR-003: querySelector returns the FIRST match even when it is
  // hidden/disabled/stale. If that first input fails the interactability check,
  // the previous code fell straight through to the header fallback, missing a
  // perfectly usable SECOND landmark input. Iterate every landmark input and
  // return the first interactable one.
  const landmarkInputs = document.querySelectorAll<HTMLInputElement>(
    '[role="search"] input[type="text"], [role="search"] input[type="search"], [role="search"] input[role="searchbox"]',
  );
  for (const input of landmarkInputs) {
    if (!isInteractable(input)) continue;
    return input;
  }
  // Fallback: a labelled text input in the header area.
  const headerInputs = document.querySelectorAll<HTMLInputElement>(
    'header input[type="text"], [role="banner"] input[type="text"]',
  );
  for (const input of headerInputs) {
    if (!isInteractable(input)) continue;
    const label = input.getAttribute("aria-label") ?? "";
    if (/search|suche/iu.test(label)) return input;
  }
  return null;
}

export function findSearchSubmitButton(): HTMLElement | null {
  // ITI-008: Prefer a submit button inside the [role="search"] landmark, so we
  // never click a button belonging to Chat/Spaces/Contacts search controls.
  const searchLandmark = document.querySelector('[role="search"]');
  if (searchLandmark) {
    const buttons = searchLandmark.querySelectorAll<HTMLElement>('[role="button"], button');
    for (const btn of buttons) {
      // CUR-002: only return interactable buttons — a hidden/disabled/stale
      // duplicate must not terminate the fallback chain prematurely.
      if (!isInteractable(btn)) continue;
      const label = `${btn.getAttribute("aria-label") ?? ""} ${btn.textContent || ""}`;
      if (/search|suchen|suche/iu.test(label)) {
        // CUR-002: exclude "search options", "search filter", "search settings"
        // buttons. findSearchSubmitButton previously returned the FIRST labelled
        // button it found, which could be Gmail's search-OPTIONS (filter) toggle
        // rather than the real submit button. Clicking that opens the options
        // panel instead of submitting, blocking the form/Enter fallback because
        // submitSearch returned on the first match. Skipping these keeps the
        // real submit button (or the form/Enter fallback) in play.
        if (/option|filter|einstellung|setting|erweitert|advanced/iu.test(label)) continue;
        return btn;
      }
    }
  }
  // Fallback: search-labelled button in the header.
  const headerButtons = document.querySelectorAll<HTMLElement>(
    'header [role="button"], header button, [role="banner"] [role="button"], [role="banner"] button',
  );
  for (const btn of headerButtons) {
    if (!isInteractable(btn)) continue;
    const label = `${btn.getAttribute("aria-label") ?? ""} ${btn.textContent || ""}`;
    if (/search|suchen|suche/iu.test(label)) {
      // CUR-002: same exclusion as the landmark loop.
      if (/option|filter|einstellung|setting|erweitert|advanced/iu.test(label)) continue;
      return btn;
    }
  }
  return null;
}

export interface SearchReadyEvidence {
  readonly queryMatches: boolean;
  readonly routeChanged: boolean;
  readonly listFingerprintChanged: boolean;
  readonly mailListDetected: boolean;
  readonly emptyStateDetected: boolean;
  readonly relatedOnlyDetected: boolean;
  readonly loadingVisible: boolean;
  readonly stableForMs: number;
}

function readSearchBoxValue(): string {
  const box = findSearchBox();
  return box ? box.value : "";
}

function routeFingerprint(): string {
  // CUR-007: include location.search — Gmail search results can change the
  // query string (e.g. ?q=...) without altering the hash, so omitting it
  // missed route changes.
  return `${location.pathname}${location.search}#${location.hash}`;
}

function listFingerprint(): string {
  // CUR-004: scope the row count to the primary mail list so unrelated global
  // rows (nav/chat/settings) don't pollute the fingerprint.
  // CUR-015/CUR-008/HIGH-03: include the per-row thread ids so a same-length
  // DOM swap is detected. For rows WITHOUT stable IDs, compute a bounded hash
  // from sender-relevant attribute VALUES (not just lengths) so different
  // senders with equal-length addresses produce different fingerprints.
  const list = findMessageListElement();
  if (!list) return "none";
  const rows = list.querySelectorAll<HTMLElement>('[role="listitem"], tr[role="row"]');
  const ids: string[] = [];
  for (const row of rows) {
    const id =
      row.getAttribute("data-thread-id") ??
      row.getAttribute("data-legacy-thread-id") ??
      row.getAttribute("id");
    if (id) {
      ids.push(id);
    } else {
      const email =
        row.getAttribute("email") ?? row.querySelector("[email]")?.getAttribute("email") ?? "";
      const hover = row.getAttribute("data-hovercard-id") ?? "";
      const hashInput = `${email}|${hover}`;
      let hash = 0;
      for (let i = 0; i < hashInput.length && i < 64; i++) {
        hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0;
      }
      ids.push(`h${String(hash)}`);
    }
  }
  return `count=${String(rows.length)};ids=${ids.join(",")}`;
}

/**
 * CUR-008: shared helper that reports whether the verified mail list currently
 * holds any rows. isEmptyState/isRelatedOnly previously checked
 * document.querySelector('[role="listitem"]') GLOBALLY, so a stray nav/chat row
 * anywhere on the page masked a genuinely empty result. Scoping to the primary
 * mail list (the same element the evidence model verifies) means the empty /
 * related-only signals reflect the real search surface.
 */
function hasScopedMailRows(): boolean {
  const list = findMessageListElement();
  return list !== null && list.querySelectorAll('[role="listitem"], tr[role="row"]').length > 0;
}

/**
 * BUG-046: read status text ONLY from scoped status regions, never from
 * document.body.textContent (which includes email subjects, snippets, etc.
 * and causes false positives — e.g. a subject containing "Laden" or "Einladen").
 */
function readStatusText(): string {
  const regions = document.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]');
  const parts: string[] = [];
  for (const region of regions) {
    if (region.closest("#giso-extension-root")) continue;
    // CUR-005: scope status regions to the main mail surface. Unrelated Gmail
    // notifications (sidebar/chat) can still match the status/alert roles and
    // cause false positives, so ignore regions that live outside [role="main"]
    // or the header.
    if (!region.closest('[role="main"]') && !region.closest("header")) continue;
    const label = region.getAttribute("aria-label") ?? "";
    const text = region.textContent || "";
    if (label) parts.push(label);
    if (text) parts.push(text);
  }
  return parts.join(" ");
}

function isRelatedOnly(): boolean {
  const text = readStatusText();
  const relatedVisible =
    matchesAny(text, gmailTextPatterns.de.related) ||
    matchesAny(text, gmailTextPatterns.en.related);
  // CUR-008: scope the row check to the verified mail list, not the whole
  // document, so unrelated global rows no longer mask a related-only state.
  return relatedVisible && !hasScopedMailRows();
}

function isEmptyState(): boolean {
  const text = readStatusText();
  const deEmpty = gmailTextPatterns.de.empty.some((p) => p.test(text));
  const enEmpty = gmailTextPatterns.en.empty.some((p) => p.test(text));
  // CUR-008: scope the row check to the verified mail list, not the whole
  // document, so unrelated global rows no longer mask a genuinely empty result.
  return (deEmpty || enEmpty) && !hasScopedMailRows();
}

function isLoading(): boolean {
  const text = readStatusText();
  return (
    matchesAny(text, gmailTextPatterns.de.loading) || matchesAny(text, gmailTextPatterns.en.loading)
  );
}

/**
 * Submit the query and wait until the ready-evidence model (§53.5) is satisfied.
 * Throws a GisoError (GISO-SEARCH-* / GISO-SEARCH-RELATED-ONLY-001) on failure.
 *
 * CUR-002: evidence-driven fallback chain. The previous implementation called a
 * single submitSearch() helper that picked ONE method (button > form > Enter)
 * and returned immediately, then waited for evidence in a separate step. If the
 * chosen method was a no-op (e.g. the "button" was Gmail's search-options toggle
 * rather than the real submit), the form/Enter fallbacks were never tried and
 * the whole call deadlocked until timeout. Instead, this function now drives the
 * fallback itself: it tries each submission method and, after each, runs a short
 * "did it start?" probe (route/list fingerprint changed) to see whether the
 * search actually began. Only when a method produces no sign of navigation does
 * it move on to the next.
 *
 * HIGH-01: in the fallback loop, only plain timeout errors (from waitForEvidence
 * surfacing as a non-GisoError "Mutation wait timed out") are treated as "this
 * submission method didn't produce results — try the next." Every structured
 * GisoError (account change, related-only, mismatch, etc.) is a hard failure
 * that another method cannot fix, so it is rethrown immediately rather than
 * being retried via a different method (which previously caused cross-account
 * submissions).
 *
 * HIGH-02: the loop no longer runs the FULL readiness check (mail list + no
 * loading + stability) inside each per-method attempt. A genuinely slow search
 * that needs >2s to fully load would fail that full probe and get retried with
 * the next method, submitting the search a second time. Now the per-method probe
 * only checks that navigation STARTED (route/list fingerprint changed); once
 * started, a single full readiness wait runs with the remaining time.
 *
 * HIGH-04: a single total deadline (performance.now() + timeoutMs) bounds the
 * whole call. Each per-method probe uses at most 3s (clamped to the remaining
 * total), and the final readiness wait gets whatever time remains. With three
 * methods the function can no longer run 3×3s + fullTimeout (21+s); it stays
 * within the configured timeoutMs.
 */
export async function submitAndWaitUntilReady(
  query: string,
  signal: AbortSignal,
  options: { readonly timeoutMs?: number; readonly stabilityMs?: number } = {},
): Promise<SearchReadyEvidence> {
  assertNotAborted(signal);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const stabilityMs = options.stabilityMs ?? 250;
  // HIGH-04: a single total deadline bounds the whole call (per-method probes
  // + the final readiness wait). Previously 3 methods × 2s probe + a full
  // timeoutMs wait could take 21+ seconds; now everything stays within
  // timeoutMs measured from entry.
  const totalDeadline = performance.now() + timeoutMs;

  const baselineRoute = routeFingerprint();
  const baselineList = listFingerprint();
  const accountSlot = detectAccountSlot();

  const box = findSearchBox();
  if (!box) {
    throwAppError(appError("GISO-SEARCH-BOX-001", "searchFailed", "search box not found", true));
  }
  box.focus();
  box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  setNativeInputValue(box, query);

  // CUR-002: build the ordered list of submission methods (§53.4). Button first,
  // then form.requestSubmit, then Enter key. Each is tried in turn below with a
  // short evidence probe between them so a no-op method no longer deadlocks the
  // whole call.
  const submitMethods: (() => void)[] = [];
  const button = findSearchSubmitButton();
  if (button)
    submitMethods.push(() => {
      button.click();
    });
  if (box.form) {
    const form = box.form;
    submitMethods.push(() => {
      form.requestSubmit();
    });
  }
  submitMethods.push(() => {
    box.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    box.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
    );
  });

  // CUR-002 / HIGH-02: try each method with a short "did it start?" probe. The
  // probe is intentionally lightweight — it only checks that navigation began
  // (route/list fingerprint changed) rather than running the FULL readiness
  // check (mail list + no loading + stability). A real slow search that needs
  // >2s to fully load would fail a full probe and get retried with the next
  // method, submitting the search a second time; a started-check avoids that.
  // The outer safeRun already provides one controlled retry on recoverable
  // errors, so this loop does NOT re-implement a timeout retry — it only walks
  // the fallback chain once, and a hard failure short-circuits the whole
  // attempt.
  let started = false;
  for (const method of submitMethods) {
    assertNotAborted(signal);
    method();
    // HIGH-02/MEDIUM-01: check immediately — the method may have synchronously
    // changed the route, the list, or surfaced a loading indicator. Recognizing
    // a synchronous start avoids an unnecessary probe loop and a wasted method
    // fallback (which would re-submit a search that already started). The
    // loading check also catches searches that show a loading indicator before
    // touching the route/list.
    if (routeFingerprint() !== baselineRoute || listFingerprint() !== baselineList || isLoading()) {
      started = true;
      break;
    }
    // HIGH-02/HIGH-04: wait up to 2 seconds per method (clamped to remaining
    // total) for ANY sign the search started. Using 2s (not 3s) ensures that
    // with a typical 12s timeout there's still time for the next method's
    // probe + the final readiness wait. If the total deadline has already
    // passed, the loop is skipped entirely and we fall through to the next
    // method's immediate check.
    const startedDeadline = Math.min(performance.now() + 2_000, totalDeadline);
    while (performance.now() < startedDeadline) {
      assertNotAborted(signal);
      await delay(100, signal);
      // MEDIUM-01: isLoading() is a third start signal — a search may show a
      // loading indicator before the route/list fingerprint changes.
      if (
        routeFingerprint() !== baselineRoute ||
        listFingerprint() !== baselineList ||
        isLoading()
      ) {
        started = true;
        break;
      }
      // HIGH-01: an account change is a hard failure even mid-probe — another
      // submission method cannot fix it, and continuing would submit the search
      // against the wrong account.
      if (detectAccountSlot() !== accountSlot) {
        throwAppError(
          appError(
            "GISO-SEARCH-ACCOUNT-001",
            "searchFailed",
            "account slot changed during search",
            false,
          ),
        );
      }
    }
    if (started) break; // submission confirmed — now do the full readiness wait
  }

  // HIGH-02: run ONE full readiness wait with the remaining time. This single
  // wait handles both outcomes: if a method started the search, we wait for it
  // to fully load; if no method started anything, the wait simply elapses and
  // waitForEvidence throws GISO-SEARCH-TIMEOUT-001. There is no separate "last
  // resort" re-submit — that would re-submit a possibly-already-running search.
  // HIGH-04: always bounded by the total deadline so the whole call stays
  // within timeoutMs.
  //
  // HIGH-01: the previous code floored the remainder at Math.max(1000, ...),
  // which granted an extra second even after the deadline had fully passed and
  // nothing had started. Now the two cases are distinguished:
  //  - If NO method started (started === false) and there is insufficient time
  //    for a stability window, fail fast with GISO-SEARCH-TIMEOUT-001 instead
  //    of granting free time past the deadline.
  //  - If a method DID start (started === true) but the per-method probe
  //    consumed most of the budget (e.g. a no-op earlier method ate the
  //    per-method probe before a later synchronous method navigated), the
  //    stability window still needs room to register. Floor the remainder at
  //    stabilityMs so the just-started search can complete its stability check
  //    without immediately timing out.
  const now = performance.now();
  if (!started && totalDeadline - now < stabilityMs) {
    throwAppError(appError("GISO-SEARCH-TIMEOUT-001", "searchFailed", "search timed out", true));
  }
  const remainingForEvidence = Math.max(totalDeadline - now, stabilityMs);
  return await waitForEvidence(
    query,
    baselineRoute,
    baselineList,
    accountSlot,
    signal,
    remainingForEvidence,
    stabilityMs,
  );
}

async function waitForEvidence(
  expectedQuery: string,
  baselineRoute: string,
  baselineList: string,
  accountSlot: number | null,
  signal: AbortSignal,
  timeoutMs: number,
  stabilityMs: number,
): Promise<SearchReadyEvidence> {
  const expected = normalizeQueryForComparison(expectedQuery);
  let stableSince = 0;
  // CUR-006: track how long the query has been mismatched. Gmail may
  // transiently clear or normalize the query right after submit; only treat a
  // sustained mismatch (~500ms) as a real failure.
  let queryMismatchSince = 0;
  const startedAt = performance.now();
  let lastEvidence: SearchReadyEvidence | null = null;

  while (performance.now() - startedAt < timeoutMs) {
    assertNotAborted(signal);
    if (detectAccountSlot() !== accountSlot) {
      throwAppError(
        appError(
          "GISO-SEARCH-ACCOUNT-001",
          "searchFailed",
          "account slot changed during search",
          false,
        ),
      );
    }
    // CUR-004: scope the mail-list detection to the primary mail list so
    // unrelated global rows anywhere on the page no longer count as evidence.
    const mailList = findMessageListElement();
    const mailListDetected =
      mailList !== null &&
      mailList.querySelectorAll('[role="listitem"], tr[role="row"]').length > 0;
    const evidence: SearchReadyEvidence = {
      queryMatches: normalizeQueryForComparison(readSearchBoxValue()) === expected,
      routeChanged: routeFingerprint() !== baselineRoute,
      listFingerprintChanged: listFingerprint() !== baselineList,
      mailListDetected,
      emptyStateDetected: isEmptyState(),
      relatedOnlyDetected: isRelatedOnly(),
      loadingVisible: isLoading(),
      stableForMs: 0,
    };
    lastEvidence = evidence;

    if (evidence.relatedOnlyDetected) {
      throwAppError(
        appError(
          "GISO-SEARCH-RELATED-ONLY-001",
          "relatedResultsOnly",
          "related-only results",
          false,
        ),
      );
    }
    // CUR-006: don't throw on a transient mismatch. Gmail may briefly clear or
    // normalize the input; only reject once the mismatch has persisted for
    // ~500ms continuously.
    if (!evidence.queryMatches) {
      if (queryMismatchSince === 0) queryMismatchSince = performance.now();
      if (performance.now() - queryMismatchSince > 500) {
        throwAppError(
          appError("GISO-SEARCH-MISMATCH-001", "searchFailed", "query mismatch", false),
        );
      }
    } else {
      queryMismatchSince = 0;
    }

    const ready =
      (evidence.mailListDetected || evidence.emptyStateDetected) &&
      !evidence.loadingVisible &&
      (evidence.routeChanged || evidence.listFingerprintChanged);

    if (ready) {
      if (stableSince === 0) stableSince = performance.now();
      if (performance.now() - stableSince >= stabilityMs) {
        return { ...evidence, stableForMs: performance.now() - stableSince };
      }
    } else {
      stableSince = 0;
    }
    await delay(50, signal);
  }
  if (lastEvidence?.emptyStateDetected) return lastEvidence;
  throwAppError(appError("GISO-SEARCH-TIMEOUT-001", "searchFailed", "search timed out", true));
}

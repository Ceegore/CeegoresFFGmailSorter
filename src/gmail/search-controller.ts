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
  const inSearchLandmark = document.querySelector<HTMLInputElement>(
    '[role="search"] input[type="text"], [role="search"] input[type="search"], [role="search"] input[role="searchbox"]',
  );
  // CUR-003: skip hidden/disabled/stale duplicates — only interactable boxes
  // count as a real search box.
  if (inSearchLandmark && isInteractable(inSearchLandmark)) return inSearchLandmark;
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
      if (/search|suchen|suche/iu.test(label)) return btn;
    }
  }
  // Fallback: search-labelled button in the header.
  const headerButtons = document.querySelectorAll<HTMLElement>(
    'header [role="button"], header button, [role="banner"] [role="button"], [role="banner"] button',
  );
  for (const btn of headerButtons) {
    if (!isInteractable(btn)) continue;
    const label = `${btn.getAttribute("aria-label") ?? ""} ${btn.textContent || ""}`;
    if (/search|suchen|suche/iu.test(label)) return btn;
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

/**
 * ITI-009: Reusable submission strategy (§53.4). Order: button click, then
 * form.requestSubmit, then Enter key. The retry path used to only re-click a
 * button when one existed, so when the first attempt fell through to
 * form.requestSubmit or Enter, the retry did nothing. Extracting this lets the
 * retry repeat the exact same strategy.
 */
function submitSearch(box: HTMLInputElement): void {
  const button = findSearchSubmitButton();
  if (button) {
    button.click();
    return;
  }
  const form = box.form;
  if (form) {
    form.requestSubmit();
    return;
  }
  box.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
  );
  box.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
  );
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
  const list = findMessageListElement();
  if (!list) return "rows=0";
  const rows = list.querySelectorAll('[role="listitem"], tr[role="row"]');
  return `rows=${String(rows.length)}`;
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
  const hasMailRows = document.querySelector('[role="listitem"], tr[role="row"]') !== null;
  return relatedVisible && !hasMailRows;
}

function isEmptyState(): boolean {
  const text = readStatusText();
  const deEmpty = gmailTextPatterns.de.empty.some((p) => p.test(text));
  const enEmpty = gmailTextPatterns.en.empty.some((p) => p.test(text));
  const hasMailRows = document.querySelector('[role="listitem"], tr[role="row"]') !== null;
  return (deEmpty || enEmpty) && !hasMailRows;
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
 */
export async function submitAndWaitUntilReady(
  query: string,
  signal: AbortSignal,
  options: { readonly timeoutMs?: number; readonly stabilityMs?: number } = {},
): Promise<SearchReadyEvidence> {
  assertNotAborted(signal);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const stabilityMs = options.stabilityMs ?? 250;

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

  // Submission order (§53.4): button, then form.requestSubmit, then Enter.
  // Enter is restored as a tertiary fallback — Gmail's search box responds to
  // Enter reliably. BUG-070's concern was about Enter as the ONLY method; here
  // it is the last resort after button and form are tried. ITI-009: the
  // strategy is factored into submitSearch so the timeout retry repeats it.
  submitSearch(box);

  try {
    return await waitForEvidence(
      query,
      baselineRoute,
      baselineList,
      accountSlot,
      signal,
      timeoutMs,
      stabilityMs,
    );
  } catch (error) {
    // BUG-036: an abort (user cancel / route change) must NEVER trigger a
    // retry click. Only a genuine timeout may retry, and only after re-checking
    // that the signal is still alive.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (!isTimeout(error)) {
      throw error;
    }
    assertNotAborted(signal);
    // One controlled timeout-retry per §15.2. ITI-009: re-resolve the search
    // box and repeat the full submission strategy (button / form / Enter) — the
    // previous retry only clicked a button, which did nothing when the first
    // attempt fell through to Enter.
    const retryBox = findSearchBox();
    if (!retryBox) {
      throwAppError(
        appError("GISO-SEARCH-BOX-001", "searchFailed", "search box not found on retry", true),
      );
    }
    // H-3: re-set the query value before retrying submission. The retry path
    // used to only re-resolve the box and repeat the submission strategy, so if
    // anything had cleared or altered the input since the first attempt, the
    // retry submitted an empty/stale query.
    setNativeInputValue(retryBox, query);
    submitSearch(retryBox);
    return await waitForEvidence(
      query,
      baselineRoute,
      baselineList,
      accountSlot,
      signal,
      timeoutMs,
      stabilityMs,
    );
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.includes("timed out");
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

// Gmail search controller (spec §53). Builds the locked quoted query, sets it
// via the native input setter, submits through the native search button (with
// form.requestSubmit and Enter as fallbacks), and waits for the ready-evidence
// model. Never searches via URL or internal RPC.
import { normalizeEmail } from "@/analyzer/email-parser";
import { assertNotAborted } from "@/shared/abort";
import { delay } from "@/shared/time";
import { gmailTextPatterns, matchesAny } from "@/gmail/gmail-text-patterns";
import { detectAccountSlot } from "@/gmail/dom-detectors";
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
  if (inSearchLandmark) return inSearchLandmark;
  // Fallback: a labelled text input in the header area.
  const headerInputs = document.querySelectorAll<HTMLInputElement>(
    'header input[type="text"], [role="banner"] input[type="text"]',
  );
  for (const input of headerInputs) {
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
      const label = `${btn.getAttribute("aria-label") ?? ""} ${btn.textContent || ""}`;
      if (/search|suchen|suche/iu.test(label)) return btn;
    }
  }
  // Fallback: search-labelled button in the header.
  const headerButtons = document.querySelectorAll<HTMLElement>(
    'header [role="button"], header button, [role="banner"] [role="button"], [role="banner"] button',
  );
  for (const btn of headerButtons) {
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

function routeFingerprint(): string {
  return `${location.pathname}#${location.hash}`;
}

function listFingerprint(): string {
  const rows = document.querySelectorAll('[role="listitem"], tr[role="row"]');
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
  // it is the last resort after button and form are tried.
  const button = findSearchSubmitButton();
  if (button) {
    button.click();
  } else {
    const form = box.form;
    if (form) {
      form.requestSubmit();
    } else {
      // Enter key as tertiary fallback — Gmail's search responds to Enter.
      box.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
      box.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }

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
    // One controlled timeout-retry per §15.2.
    const btn = findSearchSubmitButton();
    btn?.click();
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
    const evidence: SearchReadyEvidence = {
      queryMatches: normalizeQueryForComparison(readSearchBoxValue()) === expected,
      routeChanged: routeFingerprint() !== baselineRoute,
      listFingerprintChanged: listFingerprint() !== baselineList,
      mailListDetected: document.querySelector('[role="listitem"], tr[role="row"]') !== null,
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
    if (!evidence.queryMatches) {
      throwAppError(appError("GISO-SEARCH-MISMATCH-001", "searchFailed", "query mismatch", false));
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

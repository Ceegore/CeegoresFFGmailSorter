// Selection controller (spec §54). Selects the current results page via the
// toolbar checkbox, then attempts Gmail's native "select all matches" action.
// Falls back to single-page proof or manual confirmation. Every click is
// preceded by a re-resolve + isInteractable check (§51.6). Returns a discriminated
// result the controller translates into state-machine events.
import { assertNotAborted } from "@/shared/abort";
import { delay } from "@/shared/time";
import { isInteractable } from "@/shared/dom";
import { gmailTextPatterns, matchesAny } from "@/gmail/gmail-text-patterns";
import { appError, throwAppError } from "@/shared/errors";

export type SelectAllOutcome = "selected" | "single-page-proven" | "manual-required";

export interface SelectionResult {
  readonly pageSelected: boolean;
  readonly selectAllOutcome: SelectAllOutcome;
}

const PAGE_MIN_SCORE = 85;
const PAGE_DELTA = 20;
const ALL_MIN_SCORE = 90;
const ALL_DELTA = 20;

/** Find the toolbar "select page" checkbox — never a per-row checkbox. */
function findPageSelectControl(): HTMLElement | null {
  // A checkbox/radio outside any individual message row, with a toolbar
  // ancestor. role=checkbox or input[type=checkbox].
  const candidates = document.querySelectorAll<HTMLElement>(
    '[role="checkbox"], input[type="checkbox"]',
  );
  for (const candidate of candidates) {
    if (candidate.closest('[role="listitem"], tr[role="row"]')) continue; // per-row
    if (candidate.closest("#giso-extension-root")) continue;
    if (!isInteractable(candidate)) continue;
    // Toolbar context: an ancestor with role=toolbar or a header above the list.
    const inToolbar = candidate.closest('[role="toolbar"], header, [role="banner"]') !== null;
    if (inToolbar) return candidate;
  }
  // Fallback: the first non-row checkbox.
  for (const candidate of candidates) {
    if (candidate.closest('[role="listitem"], tr[role="row"]')) continue;
    if (candidate.closest("#giso-extension-root")) continue;
    if (isInteractable(candidate)) return candidate;
  }
  return null;
}

function isCheckboxChecked(el: HTMLElement): boolean {
  const aria = el.getAttribute("aria-checked");
  if (aria === "true" || aria === "mixed") return true;
  if (el instanceof HTMLInputElement) return el.checked;
  return false;
}

/** Click the page-select control and confirm a selection state change (§54.1). */
export async function selectCurrentPage(
  signal: AbortSignal,
  options: { readonly timeoutMs?: number } = {},
): Promise<boolean> {
  assertNotAborted(signal);
  const timeoutMs = options.timeoutMs ?? 4_000;
  const started = performance.now();

  const control = findPageSelectControl();
  if (!control) {
    throwAppError(
      appError("GISO-SELECT-PAGE-001", "selectFailed", "page checkbox not found", true),
    );
  }
  if (!isInteractable(control)) {
    throwAppError(
      appError("GISO-SELECT-PAGE-001", "selectFailed", "page checkbox not interactive", true),
    );
  }

  const wasChecked = isCheckboxChecked(control);
  // Re-resolve immediately before click (§51.6).
  if (!control.isConnected) {
    throwAppError(appError("GISO-SELECT-PAGE-002", "selectFailed", "stale checkbox", true));
  }
  control.click();

  // Wait for postcondition: checked state changes OR action buttons appear.
  while (performance.now() - started < timeoutMs) {
    assertNotAborted(signal);
    const nowChecked = isCheckboxChecked(control);
    const actionButtons = document.querySelectorAll(
      '[role="toolbar"] [role="button"], [role="toolbar"] button',
    ).length;
    if ((!wasChecked && nowChecked) || actionButtons > 0) return true;
    await delay(50, signal);
  }
  // One controlled retry (§16.2). isConnected is a real re-resolve guard even
  // though static types can't see DOM mutation between awaits.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (control.isConnected && isInteractable(control)) {
    control.click();
    await delay(200, signal);
    if (isCheckboxChecked(control)) return true;
  }
  throwAppError(appError("GISO-SELECT-PAGE-002", "selectFailed", "selection not confirmed", true));
}

/** Try Gmail's native "select all matching results" (§54.2). */
export async function trySelectAllMatches(
  signal: AbortSignal,
  options: { readonly waitMs?: number } = {},
): Promise<SelectAllOutcome> {
  assertNotAborted(signal);
  const waitMs = options.waitMs ?? 4_000;
  const started = performance.now();

  while (performance.now() - started < waitMs) {
    assertNotAborted(signal);
    const link = findSelectAllMatchesControl();
    if (link) {
      // Verify it is a "select all" and NOT a "deselect" control (§54.2).
      const text = visibleText(link);
      if (
        matchesAny(text, gmailTextPatterns.de.deselect) ||
        matchesAny(text, gmailTextPatterns.en.deselect)
      ) {
        return "manual-required";
      }
      if (isInteractable(link)) {
        link.click();
        await delay(300, signal);
        if (allMatchesSelected()) return "selected";
      }
      return "manual-required";
    }
    // No global link: maybe a single page (§54.4).
    if (isSinglePageProof()) return "single-page-proven";
    await delay(100, signal);
  }
  return isSinglePageProof() ? "single-page-proven" : "manual-required";
}

/** Find a "select all that match this search" control above the list (§54.2). */
export function findSelectAllMatchesControl(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    'button, [role="button"], [role="link"], a',
  );
  for (const candidate of candidates) {
    if (candidate.closest('[role="listitem"], tr[role="row"]')) continue;
    if (candidate.closest("#giso-extension-root")) continue;
    const text = visibleText(candidate);
    const deAll = matchesAny(text, gmailTextPatterns.de.selectAllMatches);
    const enAll = matchesAny(text, gmailTextPatterns.en.selectAllMatches);
    if (!deAll && !enAll) continue;
    // Must not be a deselect.
    if (
      matchesAny(text, gmailTextPatterns.de.deselect) ||
      matchesAny(text, gmailTextPatterns.en.deselect)
    ) {
      continue;
    }
    return candidate;
  }
  return null;
}

/** True when Gmail explicitly shows all matches are selected (§54.2). */
export function allMatchesSelected(): boolean {
  const text = document.body.textContent || "";
  return (
    gmailTextPatterns.de.allSelected.some((p) => p.test(text)) ||
    gmailTextPatterns.en.allSelected.some((p) => p.test(text))
  );
}

/**
 * Single-page proof (§54.4): one of three conditions must hold.
 * "Next button not visible" alone is NOT proof.
 */
export function isSinglePageProof(): boolean {
  // Condition 2: no next-page navigation AND all recognized rows selected.
  const hasNext = isInteractableNextPage();
  if (hasNext) return false;
  const rows = document.querySelectorAll('[role="listitem"], tr[role="row"]');
  if (rows.length === 0) return false;
  const allRowsSelected = [...rows].every((row) => {
    const cb = row.querySelector('[role="checkbox"], input[type="checkbox"]');
    return (
      cb &&
      (cb.getAttribute("aria-checked") === "true" || (cb instanceof HTMLInputElement && cb.checked))
    );
  });
  if (allRowsSelected) return true;
  // Condition 3: explicit "all N selected" text.
  return allMatchesSelected();
}

function isInteractableNextPage(): boolean {
  const candidates = document.querySelectorAll<HTMLElement>('button, [role="button"], a');
  for (const candidate of candidates) {
    if (candidate.closest("#giso-extension-root")) continue;
    const label = visibleText(candidate);
    if (/^(older|next|ältere|weiter)$/iu.test(label) && isInteractable(candidate)) return true;
  }
  return false;
}

function visibleText(el: HTMLElement): string {
  const label = el.getAttribute("aria-label") ?? "";
  const text = el.textContent;
  return `${label} ${text}`.trim();
}

// Score thresholds are exported for tests/adapter coordination (§51.3).
export const SELECTION_THRESHOLDS = {
  pageMinScore: PAGE_MIN_SCORE,
  pageDelta: PAGE_DELTA,
  allMinScore: ALL_MIN_SCORE,
  allDelta: ALL_DELTA,
} as const;

// Move-menu controller (spec §55). Detects the native "Move to" button via
// toolbar context + DE/EN lexicon, clicks it once (one retry allowed), and
// verifies a menu/dialog appeared. NEVER selects a label — that boundary is
// the user's (§55.3).
import { assertNotAborted } from "@/shared/abort";
import { delay } from "@/shared/time";
import { isInteractable } from "@/shared/dom";
import { gmailTextPatterns, matchesAny } from "@/gmail/gmail-text-patterns";
import { appError, throwAppError } from "@/shared/errors";

/** Find the "Move to" button in the toolbar, excluding row/sidebar/overlay. */
export function findMoveControl(): HTMLElement | null {
  const buttons = document.querySelectorAll<HTMLElement>('[role="button"], button');
  let best: HTMLElement | null = null;
  for (const btn of buttons) {
    if (btn.closest('[role="listitem"], tr[role="row"]')) continue; // per-row
    if (btn.closest("#giso-extension-root")) continue;
    if (btn.closest('nav, [role="navigation"]')) continue; // sidebar
    const text = visibleText(btn);
    const deMove = matchesAny(text, gmailTextPatterns.de.move);
    const enMove = matchesAny(text, gmailTextPatterns.en.move);
    if (!deMove && !enMove) continue;
    // Negative signals: Label/Mark/Archive/Delete/More.
    if (isNegativeMoveSignal(text)) continue;
    if (!isInteractable(btn)) continue;
    // Prefer a toolbar ancestor.
    if (btn.closest('[role="toolbar"], header, [role="banner"]')) return btn;
    best ??= btn;
  }
  return best;
}

function isNegativeMoveSignal(text: string): boolean {
  const negatives = [
    /^label$/i,
    /^mark as/i,
    /^archiv/i,
    /^delete$/i,
    /^löschen$/i,
    /^mehr$/i,
    /^more$/i,
  ];
  const normalized = text.toLowerCase();
  return negatives.some((p) => p.test(normalized));
}

/**
 * Open the native move menu. Clicks the move button, waits up to 4s for a
 * menu/dialog (§55.2), retries once on failure. Returns the detected menu
 * element. Throws GISO-MOVE-001/002 on failure.
 */
export async function openMoveMenu(
  signal: AbortSignal,
  options: { readonly timeoutMs?: number } = {},
): Promise<HTMLElement> {
  assertNotAborted(signal);
  const timeoutMs = options.timeoutMs ?? 4_000;

  const menu = await clickAndDetectMenu(signal, timeoutMs);
  if (menu) return menu;
  // One controlled retry (§55.1).
  const retry = await clickAndDetectMenu(signal, timeoutMs);
  if (retry) return retry;
  throwAppError(appError("GISO-MOVE-002", "moveMenuFailed", "move menu did not open", true));
}

async function clickAndDetectMenu(
  signal: AbortSignal,
  timeoutMs: number,
): Promise<HTMLElement | null> {
  const button = findMoveControl();
  if (!button) {
    throwAppError(appError("GISO-MOVE-001", "moveMenuFailed", "move button not found", true));
  }
  // Re-resolve before click (§51.6).
  if (!button.isConnected || !isInteractable(button)) return null;
  // BUG-014: snapshot menus that exist BEFORE the click, so we only accept a
  // newly-opened menu (not a stale/pre-existing dialog).
  const preExistingMenus = new Set<HTMLElement>(
    document.querySelectorAll<HTMLElement>('[role="menu"], [role="dialog"], [role="listbox"]'),
  );
  button.click();
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    assertNotAborted(signal);
    const menu = findMoveMenu(preExistingMenus);
    if (menu) return menu;
    await delay(50, signal);
  }
  return null;
}

/**
 * BUG-014: detect an opened move menu/dialog. A generic dialog with a text
 * field and a button is NOT sufficient — the menu must ALSO contain move-
 * specific text (DE/EN) or a "create new label" option, and it must not have
 * existed before the move button was clicked (newly-opened).
 */
export function findMoveMenu(existingMenus?: Set<HTMLElement>): HTMLElement | null {
  const menus = document.querySelectorAll<HTMLElement>(
    '[role="menu"], [role="dialog"], [role="listbox"]',
  );
  for (const menu of menus) {
    if (menu.closest("#giso-extension-root")) continue;
    if (!isInteractable(menu)) continue;
    // BUG-014: skip menus that existed before the click (not newly opened).
    if (existingMenus?.has(menu)) continue;
    // BUG-014: move-specific text is now REQUIRED. Test aria-label and
    // textContent separately (concatenation breaks anchored patterns).
    const ariaLabel = menu.getAttribute("aria-label") ?? "";
    const textContent = menu.textContent || "";
    const hasMoveText =
      matchesAny(ariaLabel, gmailTextPatterns.de.move) ||
      matchesAny(ariaLabel, gmailTextPatterns.en.move) ||
      matchesAny(textContent, gmailTextPatterns.de.move) ||
      matchesAny(textContent, gmailTextPatterns.en.move);
    const hasCreateNew =
      matchesAny(ariaLabel, gmailTextPatterns.de.createNew) ||
      matchesAny(ariaLabel, gmailTextPatterns.en.createNew) ||
      matchesAny(textContent, gmailTextPatterns.de.createNew) ||
      matchesAny(textContent, gmailTextPatterns.en.createNew);
    if (!hasMoveText && !hasCreateNew) continue;
    // Additional structural markers (label options or search field).
    const hasLabelOptions =
      menu.querySelector('[role="option"], [role="menuitem"], li, button') !== null;
    const hasSearch = menu.querySelector('input[type="text"], input[type="search"]') !== null;
    if (hasLabelOptions || hasSearch) return menu;
  }
  return null;
}

function visibleText(el: HTMLElement): string {
  const label = el.getAttribute("aria-label") ?? "";
  const text = el.textContent;
  return `${label} ${text}`.trim();
}

// Read-only Gmail DOM detection: shell, view, message list, rows. Multi-signal
// and semantic per spec §13/§51 — never a single generated CSS class as the
// sole selector. These heuristics are tuned against synthetic fixtures and are
// the primary maintenance surface (spec §35); live calibration happens in the
// human-owned Phase 11.
import type { Detection, GmailShell, GmailView } from "@/gmail/adapter";
import { detectionFail, detectionOk } from "@/gmail/adapter";
import {
  gmailTextPatterns,
  matchesAny,
  type GmailDetectionLocale,
} from "@/gmail/gmail-text-patterns";
import { isInteractable } from "@/shared/dom";

const GMAIL_HOST = "mail.google.com";

function isGmailHost(): boolean {
  return location.hostname === GMAIL_HOST;
}

/** Account slot from /mail/u/<n>/ — null if absent. */
export function detectAccountSlot(): number | null {
  const match = /\/u\/(\d+)\b/u.exec(location.pathname);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Rough locale guess from visible nav text. Falls back to "unknown". */
export function detectLocale(): GmailDetectionLocale | "unknown" {
  const text = collectVisibleNavText();
  for (const locale of ["de", "en"] as const) {
    const patterns = gmailTextPatterns[locale].inbox;
    if (text.some((t) => matchesAny(t, patterns))) return locale;
  }
  return "unknown";
}

/**
 * BUG-038: check whether the inbox nav item is the ACTIVE/current view, not
 * merely present (it's always visible). Looks for aria-current="page",
 * aria-selected="true", or a selected/active CSS class on the inbox link.
 */
function isInboxNavActive(): boolean {
  const inboxLinks = document.querySelectorAll<HTMLElement>('a[href*="#inbox"], a[href="#inbox"]');
  for (const link of inboxLinks) {
    const current = link.getAttribute("aria-current");
    const selected = link.getAttribute("aria-selected");
    if (current === "page" || selected === "true") return true;
  }
  // Fallback: if the route is exactly #inbox, accept only when there is a
  // genuinely interactable (visible) inbox link. CUR-012: the previous check
  // accepted ANY inbox link regardless of visibility, so a hidden collapsed
  // nav link (or a link in a detached/aria-hidden submenu) could falsely mark
  // the inbox as active on a non-inbox surface.
  const hash = location.hash;
  if (/^#inbox$/iu.test(hash)) {
    for (const link of inboxLinks) {
      if (!isInteractable(link)) continue;
      return true;
    }
  }
  return false;
}

function collectVisibleNavText(): string[] {
  // Look at aria-labels and link text in the left nav / top bar. Bounded scan.
  const out: string[] = [];
  const candidates = document.querySelectorAll<HTMLElement>(
    'nav, [role="navigation"], [aria-label], a[href*="#inbox"], a[href*="#search"]',
  );
  for (const el of candidates) {
    const label = el.getAttribute("aria-label");
    if (label) out.push(label);
    if (el.textContent) out.push(el.textContent);
    if (out.length > 200) break;
  }
  return out;
}

export function detectShell(): Detection<GmailShell> {
  if (!isGmailHost()) {
    return detectionFail<GmailShell>(0, ["hostname not mail.google.com"], "GISO-SHELL-001");
  }
  const byRole = document.querySelector<HTMLElement>('[role="main"]');
  const evidence: string[] = [];
  let mainRoot: HTMLElement | null = null;
  if (byRole?.isConnected) {
    mainRoot = byRole;
    evidence.push("role=main present");
  }
  if (!mainRoot) {
    const list = findMessageListElement();
    if (list) {
      mainRoot = list;
      evidence.push("message-list container as root");
    }
  }
  if (!mainRoot) {
    return detectionFail<GmailShell>(0, ["no main root located"], "GISO-SHELL-001");
  }
  const locale = detectLocale();
  evidence.push(`locale=${locale}`);
  // CUR-021: when locale is "unknown" we still allow analysis on the inbox
  // route. The search/selection/move patterns in gmail-text-patterns already
  // match BOTH de and en, and unknown-language users fall through to the V1
  // safe-mode manual workflow (no automatic clicks), so an unknown locale never
  // degrades safety — it only widens the candidate match set. Recording
  // locale="unknown" in the evidence (above) keeps the shell's locale visible to
  // diagnostics. This is the intended V1 safe fallback.
  return detectionOk({ mainRoot, locale }, 0.8, evidence);
}

export function detectCurrentView(): Detection<GmailView> {
  const evidence: string[] = [];
  const hash = location.hash;
  const search = location.search;
  const accountSlot = detectAccountSlot();

  const isSearchActive =
    /#search\b/iu.test(hash) || /[?&]q=/iu.test(search) || /[?&]search=/iu.test(search);
  if (isSearchActive) evidence.push("search route/query active");

  // BUG-038: exact route allowlist. #inbox must be EXACTLY "#inbox" (not
  // "#inbox/<thread-id>"). #label/... is NOT inbox-like (it's a user label).
  // Only #inbox and known category routes (#category/primary etc.) are allowed.
  const inboxRoute = /^#inbox$/iu.test(hash);
  // Category routes: #category/primary, #category/promotions, etc.
  // CUR-011: only the known category tabs at the top level count. A deeper
  // path like #category/primary/<thread-id> is an open thread, NOT a category
  // list view, so it must not be treated as inbox-like. The anchored regex
  // allows an optional trailing slash but rejects any further segment.
  const categoryRoute =
    /^#category\/(?:primary|promotions|social|updates|forums|reservations|travel|deals|legal)(?:\/?)?$/iu.test(
      hash,
    );
  // Explicitly reject label, sent, trash, spam, drafts, settings, etc.
  const rejectedRoute =
    /^#label\//iu.test(hash) ||
    /^#sent\b/iu.test(hash) ||
    /^#trash\b/iu.test(hash) ||
    /^#spam\b/iu.test(hash) ||
    /^#drafts\b/iu.test(hash) ||
    /^#settings\b/iu.test(hash) ||
    /^#contacts\b/iu.test(hash) ||
    /^#chat\b/iu.test(hash);
  if (inboxRoute) evidence.push("route #inbox (exact)");
  if (categoryRoute) evidence.push("route category (exact)");
  if (rejectedRoute) evidence.push("route explicitly rejected");

  // BUG-038: inboxHint must come from the ACTIVE nav item, not mere link
  // presence. The inbox link is always visible even when viewing a label.
  // Check for aria-current="page" or a selected/active state on the inbox link.
  const inboxHint = isInboxNavActive();
  if (inboxHint) evidence.push("inbox nav active (aria-current/selected)");

  // Search box empty is a weak inbox signal.
  const searchBox = document.querySelector<HTMLInputElement>('input[type="text"][aria-label]');
  const searchEmpty = searchBox ? searchBox.value.trim() === "" : false;
  if (searchEmpty) evidence.push("search box empty");

  // BUG-038: only exact inbox/category routes + active nav hint qualify.
  // A rejected route or a thread-open route (#inbox/xxx) is NOT inbox-like.
  // ITI-018: category routes (#category/primary etc.) are accepted on the
  // strength of the route itself — Gmail does not reliably mark the Inbox nav
  // link as aria-current when a category tab is active, so requiring inboxHint
  // would block legitimate category views. Only the exact #inbox route needs
  // the active nav hint.
  const isInboxLike =
    !isSearchActive && !rejectedRoute && ((inboxRoute && inboxHint) || categoryRoute);
  const viewClass = isSearchActive
    ? "search"
    : inboxRoute
      ? "inbox"
      : categoryRoute
        ? "category"
        : "other";
  return detectionOk(
    { isInboxLike, isSearchActive, accountSlot, viewClass },
    isInboxLike || isSearchActive ? 0.8 : 0.4,
    evidence,
  );
}

/** Locate the primary message list container. */
export function findMessageListElement(): HTMLElement | null {
  // Prefer a container explicitly marked as a list of mail rows.
  // CUR-013: never fall back to an unscoped table[role="grid"] — that bare
  // selector can match non-mail grids (settings, chat, etc.). Only search
  // within [role="main"], the primary mail surface.
  const candidates = document.querySelectorAll<HTMLElement>(
    'div[role="main"] table[role="grid"] tbody, div[role="main"] [role="list"]',
  );
  let best: HTMLElement | null = null;
  let bestRows = 0;
  for (const candidate of candidates) {
    const rows = countRowLikeChildren(candidate);
    if (rows > bestRows) {
      bestRows = rows;
      best = candidate;
    }
  }
  return best && bestRows > 0 ? best : null;
}

function countRowLikeChildren(container: HTMLElement): number {
  // A "row" is a tr/role=row with an interactive opener (a, button) or with a
  // sender-like attribute. This deliberately excludes ads/nav rows.
  let count = 0;
  const rows = container.querySelectorAll<HTMLElement>('[role="listitem"], tr[role="row"]');
  for (const row of rows) {
    if (looksLikeMessageRow(row)) count += 1;
  }
  return count;
}

export function looksLikeMessageRow(row: HTMLElement): boolean {
  if (!row.isConnected) return false;
  // Not inside this extension's own overlay host.
  if (row.closest("#giso-extension-root")) return false;
  // CUR-014: a bare opener (any link/button) is too permissive — it accepts
  // ads and nav rows. Require EITHER a stable thread/message id attribute OR
  // both an interactive opener AND sender evidence (an email/hovercard attr).
  const hasStableId =
    row.hasAttribute("data-thread-id") ||
    row.hasAttribute("data-legacy-thread-id") ||
    row.hasAttribute("data-message-id");
  const hasSenderAttr = row.querySelector("[email], [data-email], [data-hovercard-id]") !== null;
  const hasOpener = row.querySelector('a[href], button, [role="button"]') !== null;
  // Require stable ID, or both sender evidence AND an opener
  return hasStableId || (hasSenderAttr && hasOpener);
}

export function collectMessageRows(list: HTMLElement): HTMLElement[] {
  const rows = list.querySelectorAll<HTMLElement>('[role="listitem"], tr[role="row"]');
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];
  for (const row of rows) {
    if (seen.has(row)) continue;
    if (!looksLikeMessageRow(row)) continue;
    // Exclude nested duplicates: skip rows that contain another row.
    if (row.querySelector('[role="listitem"], tr[role="row"]')) continue;
    seen.add(row);
    out.push(row);
  }
  return out;
}

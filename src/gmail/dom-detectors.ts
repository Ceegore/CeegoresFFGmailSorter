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

  const inboxRoute = /#inbox\b/iu.test(hash);
  const categoryRoute = /#(label|category)\b/iu.test(hash);
  if (inboxRoute) evidence.push("route #inbox");
  if (categoryRoute) evidence.push("route category/label");

  const navTexts = collectVisibleNavText();
  const deInbox = navTexts.some((t) => matchesAny(t, gmailTextPatterns.de.inbox));
  const enInbox = navTexts.some((t) => matchesAny(t, gmailTextPatterns.en.inbox));
  const inboxHint = deInbox || enInbox;
  if (inboxHint) evidence.push("inbox/category nav hint");

  // Search box empty is a weak inbox signal.
  const searchBox = document.querySelector<HTMLInputElement>('input[type="text"][aria-label]');
  const searchEmpty = searchBox ? searchBox.value.trim() === "" : false;
  if (searchEmpty) evidence.push("search box empty");

  const isInboxLike = !isSearchActive && (inboxRoute || categoryRoute) && inboxHint;
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
  const candidates = document.querySelectorAll<HTMLElement>(
    'div[role="main"] table[role="grid"] tbody, div[role="main"] [role="list"], table[role="grid"]',
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
  // Has an interactive opener or a thread id attribute, and is not inside the
  // overlay host.
  if (row.closest("#giso-extension-root")) return false;
  const hasOpener =
    row.querySelector('a[href], button, [role="button"]') !== null ||
    row.hasAttribute("data-thread-id") ||
    row.hasAttribute("data-legacy-thread-id") ||
    row.hasAttribute("data-message-id");
  return hasOpener;
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

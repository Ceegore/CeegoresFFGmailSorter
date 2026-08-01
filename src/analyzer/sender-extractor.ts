// Sender extractor (spec §14, §52). Fuses multiple DOM observations into one
// SenderIdentity with a confidence level. V1 does NOT use the hovercard
// fallback automatically inside extractSender; the analyzer may opt in via the
// budgeted hovercard resolver (not yet wired — Phase 04 keeps it read-only and
// attribute-driven).
import { normalizeEmail, parseEmailCandidate } from "@/analyzer/email-parser";
import type { SenderIdentity } from "@/shared/types";

interface SenderObservation {
  readonly source: SenderIdentity["source"];
  readonly raw: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly confidence: "high" | "medium" | "low";
}

const HIGH_SOURCES: ReadonlySet<SenderIdentity["source"]> = new Set([
  "email-attribute",
  "hovercard-id",
  "data-email",
]);

/**
 * CUR-020: test whether a sender-attribute-bearing element is part of a
 * recipient/contact/calendar widget rather than a genuine sender element.
 * querySelectorAll(row, "[email]") previously scanned EVERY email-bearing
 * descendant, including the recipient/contact/attendee spans Gmail renders
 * inside a thread row, which created false sender conflicts (a thread listing
 * several recipients resolved to "unresolved" even when the sender was clear).
 *
 * We must NOT collapse the scan to the first sender cell, because legitimate
 * multi-participant threads render MULTIPLE sibling sender elements at the row
 * level (ITI-015) and those must still trip the conflict guard. The structural
 * difference is region: recipient/contact widgets live inside an explicit
 * recipient region (an aria/role marker or a Gmail "to/cc/bcc" container),
 * whereas sender elements live in the row's sender column. This predicate
 * returns true for elements inside such a recipient region so they can be
 * excluded from the sender scan.
 */
function isInsideRecipientWidget(el: HTMLElement): boolean {
  return el.closest<HTMLElement>(
    '[role="listitem"][data-recipient], [aria-label*="Empfänger" i], [aria-label*="recipient" i], [aria-label*="To" i], [aria-label*="Cc" i], [aria-label*="Bcc" i], .recipient, .contact-widget',
  )
    ? true
    : false;
}

function readAttributeSources(row: HTMLElement): SenderObservation[] {
  const obs: SenderObservation[] = [];

  // ITI-015: collect ALL sender-specific attribute observations, not just the
  // first. Multi-participant threads render multiple sender elements, and
  // reading only the first match (via querySelector) could misattribute the
  // row to a single participant. querySelectorAll gathers every observation so
  // the existing conflict detection (uniqueEmails.size > 1) fires correctly.
  // BUG-012: these attributes are sender-specific and do not appear on
  // subject/attachment elements.
  // CUR-020: skip elements that belong to a recipient/contact/calendar widget
  // (see isInsideRecipientWidget) so those do not create false conflicts.

  // Email attribute
  const rowEmail = row.getAttribute("email");
  if (rowEmail) {
    obs.push(observe("email-attribute", rowEmail));
  }
  for (const el of row.querySelectorAll<HTMLElement>("[email]")) {
    if (isInsideRecipientWidget(el)) continue;
    const val = el.getAttribute("email");
    if (val) obs.push(observe("email-attribute", val));
  }

  // Hovercard ID
  const hover = row.getAttribute("data-hovercard-id");
  if (hover) obs.push(observe("hovercard-id", hover));
  for (const el of row.querySelectorAll<HTMLElement>("[data-hovercard-id]")) {
    if (isInsideRecipientWidget(el)) continue;
    const val = el.getAttribute("data-hovercard-id");
    if (val) obs.push(observe("hovercard-id", val));
  }

  // Data-email
  const dataEmail = row.getAttribute("data-email");
  if (dataEmail) obs.push(observe("data-email", dataEmail));
  for (const el of row.querySelectorAll<HTMLElement>("[data-email]")) {
    if (isInsideRecipientWidget(el)) continue;
    const val = el.getAttribute("data-email");
    if (val) obs.push(observe("data-email", val));
  }

  // BUG-012: title and aria-label are LOWER-confidence sources. Reading the
  // first arbitrary [title] or [aria-label] descendant can pick up the subject,
  // an attachment name, or a date. Instead, scope these to the "sender cell" —
  // the element that carries one of the high-confidence email attributes.
  const senderCell = findSenderCell(row);
  if (senderCell) {
    const title = senderCell.getAttribute("title");
    if (title) obs.push(observe("title", title));
    const aria = senderCell.getAttribute("aria-label");
    if (aria) obs.push(observe("aria-label", aria));
  }

  return obs;
}

/**
 * BUG-012: find the "sender cell" — the element that carries a sender-specific
 * attribute. Title/aria-label are only read from THIS element, preventing
 * subject/snippet/attachment text from masquerading as sender info.
 */
function findSenderCell(row: HTMLElement): HTMLElement | null {
  // ITI-016: check the row itself first. Attributes can live on the row
  // element rather than on a descendant, so querySelector-only scanning would
  // miss them and fall back to reading title/aria-label off the wrong element.
  if (
    row.hasAttribute("email") ||
    row.hasAttribute("data-email") ||
    row.hasAttribute("data-hovercard-id")
  ) {
    return row;
  }
  return row.querySelector<HTMLElement>("[email], [data-email], [data-hovercard-id]") ?? null;
}

function observe(source: SenderIdentity["source"], raw: string): SenderObservation {
  const parsed = parseEmailCandidate(raw);
  if (!parsed.ok) {
    return {
      source,
      raw,
      email: null,
      displayName: raw.trim() || null,
      confidence: "low" as const,
    };
  }
  const email = parsed.value.email;
  const confidence: SenderObservation["confidence"] = HIGH_SOURCES.has(source)
    ? "high"
    : source === "visible-text"
      ? "low"
      : "medium";
  return { source, raw, email, displayName: parsed.value.displayName, confidence };
}

export function extractSenderFromRow(row: HTMLElement): SenderIdentity {
  const observations = readAttributeSources(row);
  const diagnostics: string[] = [];

  // Normalize all emails; keep only valid ones.
  const validObs = observations.filter((o) => o.email !== null) as (SenderObservation & {
    email: string;
  })[];
  const uniqueEmails = new Set(validObs.map((o) => o.email));

  if (uniqueEmails.size > 1) {
    diagnostics.push("GISO-SENDER-CONFLICT-001");
    return unresolved(diagnostics);
  }

  if (uniqueEmails.size === 1) {
    const [email] = [...uniqueEmails];
    if (!email) return unresolved(diagnostics);
    // Pick the highest-confidence observation for this email.
    const sorted = [...validObs]
      .filter((o) => o.email === email)
      .sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence));
    const best = sorted[0];
    if (!best) return unresolved(diagnostics);
    const displayName =
      best.displayName ??
      validObs.find((o) => o.email === email && o.displayName)?.displayName ??
      null;
    return {
      normalizedEmail: email,
      rawEmail: best.raw,
      displayName,
      source: best.source,
      confidence: best.confidence,
      diagnostics,
    };
  }

  // BUG-041: never store row.textContent — it can contain subject, snippet,
  // date, and label text. Unresolved rows get a safe generic label only.
  return unresolved(diagnostics);
}

/** BUG-041: unresolved identity uses a generic label, never row text. */
function unresolved(diagnostics: string[]): SenderIdentity {
  diagnostics.push("GISO-SENDER-UNRESOLVED-001");
  return {
    normalizedEmail: null,
    rawEmail: null,
    displayName: null,
    source: "none",
    confidence: "unresolved",
    diagnostics,
  };
}

function rankConfidence(c: SenderObservation["confidence"]): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

// Currently unused; kept for potential future hovercard validation.
export function revalidateEmail(email: string): string | null {
  const r = normalizeEmail(email);
  return r.ok ? r.value : null;
}

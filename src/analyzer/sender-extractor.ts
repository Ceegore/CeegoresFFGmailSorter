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

function readAttributeSources(row: HTMLElement): SenderObservation[] {
  const obs: SenderObservation[] = [];

  const emailAttr =
    row.getAttribute("email") ?? row.querySelector("[email]")?.getAttribute("email");
  if (emailAttr) obs.push(observe("email-attribute", emailAttr));

  const hover =
    row.getAttribute("data-hovercard-id") ??
    row.querySelector("[data-hovercard-id]")?.getAttribute("data-hovercard-id");
  if (hover) obs.push(observe("hovercard-id", hover));

  const dataEmail =
    row.getAttribute("data-email") ?? row.querySelector("[data-email]")?.getAttribute("data-email");
  if (dataEmail) obs.push(observe("data-email", dataEmail));

  const titled = row.querySelector<HTMLElement>("[title]");
  const title = titled?.getAttribute("title");
  if (title) obs.push(observe("title", title));

  const labelled = row.querySelector<HTMLElement>("[aria-label]");
  const aria = labelled?.getAttribute("aria-label");
  if (aria) obs.push(observe("aria-label", aria));

  return obs;
}

function observe(source: SenderIdentity["source"], raw: string): SenderObservation {
  const parsed = parseEmailCandidate(raw);
  if (!parsed.ok) {
    return {
      source,
      raw,
      email: null,
      displayName: raw.trim() || null,
      confidence: source === "visible-text" ? "low" : "low",
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
    return unresolved(row, diagnostics);
  }

  if (uniqueEmails.size === 1) {
    const [email] = [...uniqueEmails];
    if (!email) return unresolved(row, diagnostics);
    // Pick the highest-confidence observation for this email.
    const sorted = [...validObs]
      .filter((o) => o.email === email)
      .sort((a, b) => rankConfidence(b.confidence) - rankConfidence(a.confidence));
    const best = sorted[0];
    if (!best) return unresolved(row, diagnostics);
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

  // No valid email from attributes. Visible-text-only is "low" and must never
  // trigger a global action (enforced by grouping).
  const visible = (row.textContent || "").trim();
  if (visible) {
    diagnostics.push("visible-text-only");
    return {
      normalizedEmail: null,
      rawEmail: null,
      displayName: visible.slice(0, 80) || null,
      source: "visible-text",
      confidence: "low",
      diagnostics,
    };
  }
  return unresolved(row, diagnostics);
}

function unresolved(row: HTMLElement, diagnostics: string[]): SenderIdentity {
  diagnostics.push("GISO-SENDER-UNRESOLVED-001");
  const text = (row.textContent || "").trim();
  return {
    normalizedEmail: null,
    rawEmail: null,
    displayName: text.slice(0, 80) || null,
    source: "none",
    confidence: "unresolved",
    diagnostics,
  };
}

function rankConfidence(c: SenderObservation["confidence"]): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

/** Re-validate an already-normalized email string (used by the analyzer). */
export function revalidateEmail(email: string): string | null {
  const r = normalizeEmail(email);
  return r.ok ? r.value : null;
}

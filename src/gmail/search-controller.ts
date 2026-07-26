// Phase 05 will add submit/waitUntilReady. For now only the query builder that
// the state machine and preview depend on is implemented (spec §53.1).
import { normalizeEmail } from "@/analyzer/email-parser";

export function buildInboxSenderQuery(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized.ok) throw new Error(`Invalid sender email: ${normalized.error}`);
  return `in:inbox "from:${normalized.value}"`;
}

export function normalizeQueryForComparison(value: string): string {
  return value.normalize("NFKC").replace(/[“”]/gu, '"').replace(/\s+/gu, " ").trim().toLowerCase();
}

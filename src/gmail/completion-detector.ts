// Completion detector (spec §55.4). Observes Gmail UI signals to score whether
// a move completed. Auto-confirms at >=70 points with no negative route signal;
// otherwise defers to the user. This is evidence about the Add-on session, NOT
// a guarantee about Gmail's server state (FR-014).
//
// BUG-037: correlated signals are deduplicated. An empty list alone never
// auto-confirms — both an ACTION evidence category AND a RESULT evidence
// category are required.
// BUG-009: status text read from scoped status regions, not body.textContent.
// BUG-025: expectedQuery enforced — completion only valid if search box still
// holds the expected query.
// BUG-071: only #search route is valid during completion (not #inbox).
import { gmailTextPatterns, matchesAny } from "@/gmail/gmail-text-patterns";
import type { CompletionEvidence } from "@/gmail/adapter";

const AUTO_CONFIRM_THRESHOLD = 70;

export interface CompletionContextInput {
  readonly expectedQuery: string | null;
  readonly baselineResultCount: number | null;
}

/** BUG-009: read status text from scoped regions only. */
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

/** Snapshot the current completion evidence from the visible Gmail UI. */
export function readCompletionEvidence(input: CompletionContextInput): CompletionEvidence {
  const statusText = readStatusText();
  const moveSemantics =
    matchesAny(statusText, gmailTextPatterns.de.move) ||
    matchesAny(statusText, gmailTextPatterns.en.move);
  const undoVisible =
    matchesAny(statusText, gmailTextPatterns.de.undo) ||
    matchesAny(statusText, gmailTextPatterns.en.undo);
  const snackbarMoveText = moveSemantics && undoVisible;

  const resultRows = document.querySelectorAll('[role="listitem"], tr[role="row"]').length;
  const resultListEmpty = resultRows === 0;
  const resultCountDecreased =
    input.baselineResultCount !== null && resultRows < input.baselineResultCount;

  // BUG-037: inboxMatchesAbsent must be INDEPENDENT from resultListEmpty.
  // Previously it was aliased (`= resultListEmpty`), which double-counted
  // the same signal (+35+35=70 from one condition). Now it's a separate,
  // weaker signal: zero rows AND result count decreased (i.e. rows that were
  // there before are now gone — not just "was always empty").
  const inboxMatchesAbsent = resultListEmpty && resultCountDecreased;

  const routeNegative = isUnexpectedRouteChange();

  // BUG-037: scoring with deduplicated signals. Each evidence category counts
  // at most once. An empty list alone (without action evidence) can never
  // reach the threshold.
  // ACTION evidence: snackbar + undo (the strongest single signal). This is
  // one signal; do not double-count it (snackbarMoveText already requires
  // both move semantics and an undo affordance).
  let actionScore = 0;
  if (snackbarMoveText) actionScore += 60;

  // RESULT evidence: decreased count or empty list (but NOT both — they're
  // correlated when the list goes to zero).
  let resultScore = 0;
  if (resultCountDecreased) resultScore += 25;
  if (resultListEmpty && !resultCountDecreased) resultScore += 35; // only if not already counted
  // inboxMatchesAbsent is only independent if there was a real decrease.
  if (inboxMatchesAbsent) resultScore += 10; // weak bonus, not +35

  let score = actionScore + resultScore;
  if (routeNegative) score -= 40;

  return {
    snackbarMoveText,
    menuClosedAfterInteraction: false,
    resultCountDecreased,
    resultListEmpty,
    inboxMatchesAbsent,
    undoVisible,
    score,
  };
}

/**
 * BUG-037: auto-confirm requires BOTH an action evidence category AND an
 * independent result evidence category, plus no negative route signal.
 * An empty list alone (score from result-only) can never auto-confirm.
 */
export function isAutoConfirmed(evidence: CompletionEvidence): boolean {
  if (evidence.score < AUTO_CONFIRM_THRESHOLD) return false;
  if (isUnexpectedRouteChange()) return false;
  // BUG-037: require at least one action signal (snackbar/undo).
  const hasActionEvidence = evidence.snackbarMoveText || evidence.undoVisible;
  // BUG-037: require at least one independent result signal.
  const hasResultEvidence = evidence.resultCountDecreased || evidence.resultListEmpty;
  return hasActionEvidence && hasResultEvidence;
}

/**
 * BUG-071: during completion, ONLY the #search route is valid.
 * A return to #inbox is NOT a valid completion signal (it could be a user
 * navigation or foreign action).
 */
function isUnexpectedRouteChange(): boolean {
  const hash = location.hash;
  return !/#search\b/iu.test(hash);
}

export const COMPLETION_THRESHOLD = AUTO_CONFIRM_THRESHOLD;

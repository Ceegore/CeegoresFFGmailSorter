// Completion detector (spec §55.4). Observes Gmail UI signals to score whether
// a move completed. Auto-confirms at >=70 points with no negative route signal;
// otherwise defers to the user. This is evidence about the Add-on session, NOT
// a guarantee about Gmail's server state (FR-014).
import { gmailTextPatterns, matchesAny } from "@/gmail/gmail-text-patterns";
import type { CompletionEvidence } from "@/gmail/adapter";

const AUTO_CONFIRM_THRESHOLD = 70;

export interface CompletionContextInput {
  readonly expectedQuery: string | null;
  readonly baselineResultCount: number | null;
}

/** Snapshot the current completion evidence from the visible Gmail UI. */
export function readCompletionEvidence(input: CompletionContextInput): CompletionEvidence {
  const bodyText = document.body.textContent || "";
  const moveSemantics =
    matchesAny(bodyText, gmailTextPatterns.de.move) ||
    matchesAny(bodyText, gmailTextPatterns.en.move);
  const undoVisible =
    gmailTextPatterns.de.undo.some((p) => p.test(bodyText)) ||
    gmailTextPatterns.en.undo.some((p) => p.test(bodyText));
  const snackbarMoveText = moveSemantics && undoVisible;

  const resultRows = document.querySelectorAll('[role="listitem"], tr[role="row"]').length;
  const resultListEmpty = resultRows === 0;
  const resultCountDecreased =
    input.baselineResultCount !== null && resultRows < input.baselineResultCount;

  // Inbox-match-absent: no row whose text contains the sender domain. We avoid
  // reading addresses; this is a coarse structural signal only.
  const inboxMatchesAbsent = resultListEmpty;

  const routeNegative = isUnexpectedRouteChange();

  let score = 0;
  if (snackbarMoveText) score += 60;
  if (undoVisible && moveSemantics) score += 25;
  if (resultListEmpty) score += 35;
  if (resultCountDecreased) score += 25;
  if (inboxMatchesAbsent) score += 35;
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

/** Auto-confirm only at >= threshold and without a negative route signal. */
export function isAutoConfirmed(evidence: CompletionEvidence): boolean {
  return evidence.score >= AUTO_CONFIRM_THRESHOLD && !isUnexpectedRouteChange();
}

function isUnexpectedRouteChange(): boolean {
  // The workflow stays on the search route; leaving it is a negative signal.
  const hash = location.hash;
  return !/#search\b/iu.test(hash) && !/#inbox\b/iu.test(hash);
}

export const COMPLETION_THRESHOLD = AUTO_CONFIRM_THRESHOLD;

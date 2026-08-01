// L-1: this whole module is marked @deprecated (see the block below). The
// strict type-checked lint config would otherwise flag every internal
// self-reference to the deprecated exports, so disable the rule for the file;
// external callers (currently none) still see the deprecation via the JSDoc tag.
/* eslint-disable @typescript-eslint/no-deprecated */
/**
 * @deprecated This module is currently unused in production. The click-safety
 * architecture (§51.4) requires these functions to be wired into the
 * search/selection/move controllers before SAFE_MODE can be disabled.
 * See the QA report ITI-030.
 */
// Candidate scoring primitives (spec §51.4). The adapter scores Gmail element
// candidates; the workflow layer decides via selectUnambiguous whether a click
// is safe (score >= minimum AND margin >= delta, exactly one winner).
export interface CandidateEvidence {
  readonly code: string;
  readonly score: number;
  readonly detail: string;
}

export interface ScoredCandidate<T extends Element> {
  readonly element: T;
  readonly score: number;
  readonly evidence: readonly CandidateEvidence[];
}

export function scoreCandidate<T extends Element>(
  element: T,
  rules: readonly ((element: T) => CandidateEvidence | null)[],
): ScoredCandidate<T> {
  const evidence = rules
    .map((rule) => rule(element))
    .filter((item): item is CandidateEvidence => item !== null);
  return { element, evidence, score: evidence.reduce((sum, item) => sum + item.score, 0) };
}

export function selectUnambiguous<T extends Element>(
  candidates: readonly ScoredCandidate<T>[],
  minimum: number,
  delta: number,
): ScoredCandidate<T> | null {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  if (!best || best.score < minimum) return null;
  const second = sorted[1];
  if (second && best.score - second.score < delta) return null;
  return best;
}

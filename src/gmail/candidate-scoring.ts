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

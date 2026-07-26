// Row fingerprints are session-internal and must never encode subject lines,
// snippets, full row labels or account identity (spec §50.1).
export interface RowFingerprint {
  readonly value: string;
  readonly strength: "stable" | "weak";
}

const STABLE_ATTRIBUTES = [
  "data-legacy-thread-id",
  "data-thread-id",
  "data-message-id",
  "id",
] as const;

export function fingerprintRow(
  row: HTMLElement,
  index: number,
  analysisRunId: string,
): RowFingerprint {
  for (const name of STABLE_ATTRIBUTES) {
    const value = row.getAttribute(name)?.trim();
    if (value) return { value: `attr:${name}:${value}`, strength: "stable" };
  }
  return { value: `weak:${analysisRunId}:${String(index)}`, strength: "weak" };
}

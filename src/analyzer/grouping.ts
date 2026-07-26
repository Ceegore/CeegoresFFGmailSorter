// Deterministic sender grouping (spec §50.2). Groups by normalized email,
// drops singletons (< minimumOccurrences), excludes low/unresolved confidence,
// dedupes by fingerprint, and selects the most-frequent display name.
import type { AnalyzedEntry, SenderGroup } from "@/shared/types";

function choosePrimaryName(names: readonly string[], fallback: string): string {
  const counts = new Map<string, { count: number; first: number }>();
  names.forEach((name, index) => {
    const current = counts.get(name);
    counts.set(name, { count: (current?.count ?? 0) + 1, first: current?.first ?? index });
  });
  return (
    [...counts.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[1].first - b[1].first,
    )[0]?.[0] ?? fallback
  );
}

export function compareByCountThenName(a: SenderGroup, b: SenderGroup): number {
  return (
    b.visibleEntryCount - a.visibleEntryCount ||
    a.primaryDisplayName.localeCompare(b.primaryDisplayName)
  );
}

export function groupResolvedSenders(
  entries: readonly AnalyzedEntry[],
  minimumOccurrences = 2,
): SenderGroup[] {
  if (!Number.isInteger(minimumOccurrences) || minimumOccurrences < 2) {
    throw new Error("minimumOccurrences must be an integer >= 2");
  }
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.fingerprint, entry])).values()];
  const buckets = new Map<string, AnalyzedEntry[]>();
  for (const entry of uniqueEntries) {
    const email = entry.sender.normalizedEmail;
    if (!email || !["high", "medium"].includes(entry.sender.confidence)) continue;
    const bucket = buckets.get(email) ?? [];
    bucket.push(entry);
    buckets.set(email, bucket);
  }

  return [...buckets.entries()].flatMap(([email, bucket]) => {
    if (bucket.length < minimumOccurrences) return [];
    const names = bucket.map((entry) => entry.sender.displayName?.trim() ?? "").filter(Boolean);
    const fingerprints = bucket.map((entry) => entry.fingerprint);
    return [
      {
        id: `sender:${email}`,
        normalizedEmail: email,
        displayNames: [...new Set(names)],
        primaryDisplayName: choosePrimaryName(names, email),
        visibleEntryCount: bucket.length,
        sourceFingerprints: fingerprints,
        confidence: bucket.every((entry) => entry.sender.confidence === "high") ? "high" : "medium",
        status: "ready",
      } satisfies SenderGroup,
    ];
  });
}

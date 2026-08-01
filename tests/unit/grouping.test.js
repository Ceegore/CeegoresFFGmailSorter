import { describe, expect, it } from "vitest";
import { groupResolvedSenders, compareByCountThenName } from "@/analyzer/grouping";
function entry(fingerprint, email, confidence = "high", name = "Sender") {
  return {
    fingerprint,
    rowIndex: 0,
    sender: {
      normalizedEmail: email,
      rawEmail: email,
      displayName: name,
      source: "email-attribute",
      confidence,
      diagnostics: [],
    },
  };
}
describe("groupResolvedSenders", () => {
  it("groups identical email addresses and counts unique fingerprints", () => {
    const groups = groupResolvedSenders([
      entry("f1", "a@example.com"),
      entry("f2", "a@example.com"),
      entry("f3", "b@example.com"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.visibleEntryCount).toBe(2);
  });
  it("keeps same display name with different emails as separate groups", () => {
    const groups = groupResolvedSenders([
      entry("f1", "a@example.com", "high", "Name"),
      entry("f2", "a@example.com", "high", "Name"),
      entry("f3", "b@example.com", "high", "Name"),
      entry("f4", "b@example.com", "high", "Name"),
    ]);
    expect(groups.map((g) => g.normalizedEmail).sort()).toEqual(["a@example.com", "b@example.com"]);
  });
  it("merges same email with different display names into one group", () => {
    const groups = groupResolvedSenders([
      entry("f1", "a@example.com", "high", "Name1"),
      entry("f2", "a@example.com", "high", "Name2"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.displayNames).toHaveLength(2);
  });
  it("dedupes identical fingerprints (counts once)", () => {
    const groups = groupResolvedSenders([
      entry("same", "a@example.com"),
      entry("same", "a@example.com"),
      entry("other", "a@example.com"),
    ]);
    expect(groups[0]?.visibleEntryCount).toBe(2);
  });
  it("excludes low/unresolved confidence from global groups", () => {
    const groups = groupResolvedSenders([
      entry("f1", "a@example.com", "low"),
      entry("f2", "a@example.com", "low"),
      entry("f3", "b@example.com", "unresolved"),
      entry("f4", "b@example.com", "unresolved"),
    ]);
    expect(groups).toHaveLength(0);
  });
  it("drops singletons (count < 2)", () => {
    const groups = groupResolvedSenders([
      entry("f1", "a@example.com"),
      entry("f2", "b@example.com"),
    ]);
    expect(groups).toHaveLength(0);
  });
  it("picks the most frequent display name, ties broken by first observed", () => {
    const groups = groupResolvedSenders([
      entry("f1", "a@example.com", "high", "Alpha"),
      entry("f2", "a@example.com", "high", "Beta"),
      entry("f3", "a@example.com", "high", "Beta"),
    ]);
    expect(groups[0]?.primaryDisplayName).toBe("Beta");
  });
  it("sorts by count descending then name ascending (analyzer applies the comparator)", () => {
    const groups = groupResolvedSenders([
      entry("f1", "b@example.com", "high", "Zeta"),
      entry("f2", "b@example.com", "high", "Zeta"),
      entry("f3", "a@example.com", "high", "Alpha"),
      entry("f4", "a@example.com", "high", "Alpha"),
      entry("f5", "a@example.com", "high", "Alpha"),
    ]).sort(compareByCountThenName);
    expect(groups.map((g) => g.normalizedEmail)).toEqual(["a@example.com", "b@example.com"]);
  });
  it("rejects minimumOccurrences < 2", () => {
    expect(() => groupResolvedSenders([], 1)).toThrow();
  });
});

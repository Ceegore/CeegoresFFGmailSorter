import { describe, expect, it } from "vitest";
import { buildInboxSenderQuery, normalizeQueryForComparison } from "@/gmail/search-controller";

describe("buildInboxSenderQuery", () => {
  it("produces the exact quoted inbox query", () => {
    expect(buildInboxSenderQuery("news@example.com")).toBe('in:inbox "from:news@example.com"');
  });
  it("normalizes case before building", () => {
    expect(buildInboxSenderQuery("NEWS@Example.COM")).toBe('in:inbox "from:news@example.com"');
  });
  it("rejects an invalid email", () => {
    expect(() => buildInboxSenderQuery("not-an-email")).toThrow();
  });
  it("does not allow injecting extra operators via the address", () => {
    // The address is validated; spaces and operators make it invalid.
    expect(() => buildInboxSenderQuery("a@example.com) OR in:anywhere")).toThrow();
  });
});

describe("normalizeQueryForComparison", () => {
  it("treats extra whitespace and curly quotes as equal", () => {
    const a = normalizeQueryForComparison('in:inbox  "from:a@example.com"');
    const b = normalizeQueryForComparison("in:inbox “from:a@example.com”");
    expect(a).toBe(b);
  });
});

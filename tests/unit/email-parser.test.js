import { describe, expect, it } from "vitest";
import { normalizeEmail, parseEmailCandidate } from "@/analyzer/email-parser";
describe("normalizeEmail", () => {
  it("normalizes a simple address", () => {
    expect(normalizeEmail("alice@example.com")).toEqual({ ok: true, value: "alice@example.com" });
  });
  it("lowercases local and domain and strips angle brackets", () => {
    expect(normalizeEmail("First.Last+tag@GMAIL.COM")).toEqual({
      ok: true,
      value: "first.last+tag@gmail.com",
    });
  });
  it("preserves plus tags and dots", () => {
    expect(normalizeEmail("<plus+tag@example.com>")).toEqual({
      ok: true,
      value: "plus+tag@example.com",
    });
  });
  it("normalizes an IDN domain to punycode", () => {
    expect(normalizeEmail("user@bücher.de")).toEqual({ ok: true, value: "user@xn--bcher-kva.de" });
  });
  it.each([
    "a@example.com/path",
    "a@example.com?x",
    "a@example.com#x",
    "a@example.com:443",
    "a@localhost",
    ".alice@example.com",
    "alice..x@example.com",
  ])("rejects invalid input %s", (value) => {
    expect(normalizeEmail(value).ok).toBe(false);
  });
  it("rejects an empty string", () => {
    expect(normalizeEmail("")).toEqual({ ok: false, error: "EMPTY" });
  });
  it("rejects control characters", () => {
    expect(normalizeEmail("a\u0000b@example.com")).toEqual({
      ok: false,
      error: "CONTROL_CHARACTER",
    });
  });
});
describe("parseEmailCandidate", () => {
  it("removes the original uppercase match from the display name", () => {
    expect(parseEmailCandidate("Alice <ALICE@Example.COM>")).toEqual({
      ok: true,
      value: { displayName: "Alice", email: "alice@example.com" },
    });
  });
  it("parses parenthesised form", () => {
    expect(parseEmailCandidate("Name (a@example.com)").ok).toBe(true);
  });
  it("rejects two distinct addresses", () => {
    expect(parseEmailCandidate("a@example.com b@example.com")).toEqual({
      ok: false,
      error: "MULTIPLE_EMAILS",
    });
  });
  it("accepts the same address twice as a single identity", () => {
    const r = parseEmailCandidate("a@example.com a@example.com");
    expect(r.ok && r.value.email).toBe("a@example.com");
  });
  it("preserves a unicode display name", () => {
    const r = parseEmailCandidate("Müller GmbH <info@example.com>");
    expect(r.ok && r.value.displayName).toBe("Müller GmbH");
  });
  it("rejects empty input", () => {
    expect(parseEmailCandidate("")).toEqual({ ok: false, error: "EMPTY" });
  });
});

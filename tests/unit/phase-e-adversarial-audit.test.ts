// Phase E adversarial audit: BUG-005 (Unicode email truncation), BUG-055
// (bidi/format char stripping), BUG-049 (diagnostic DTO leak scan).
import { describe, expect, it } from "vitest";
import { normalizeEmail, parseEmailCandidate } from "@/analyzer/email-parser";
import { buildDiagnosticDto, createDiagnosticBlob } from "@/privacy/diagnostic-export";

describe("ADVERSARIAL E: BUG-005 Unicode truncation", () => {
  it("üser@example.com does NOT truncate to ser@example.com", () => {
    const r = parseEmailCandidate("üser@example.com");
    // The boundary requirement means the regex can't find "ser@example.com"
    // starting in the middle of "üser" — ü is a letter so "s" is not at a
    // boundary. Either it matches the full token (impossible, ü not in LOCAL)
    // or it doesn't match at all.
    expect(r.ok).toBe(false);
  });

  it("user@example.com still parses normally", () => {
    expect(normalizeEmail("user@example.com")).toEqual({ ok: true, value: "user@example.com" });
  });

  it("Name <user@example.com> still parses normally", () => {
    const r = parseEmailCandidate("Alice <user@example.com>");
    expect(r.ok).toBe(true);
  });

  it("müller@example.com does NOT truncate", () => {
    const r = parseEmailCandidate("müller@example.com");
    expect(r.ok).toBe(false);
  });
});

describe("ADVERSARIAL E: BUG-055 bidi/format char stripping", () => {
  it("zero-width and bidi chars stripped from display name", () => {
    // U+200B (ZWSP), U+202E (RLO override) inserted into the name.
    const r = parseEmailCandidate("Alice\u200E\u202E <alice@example.com>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.displayName).not.toContain("\u200E");
      expect(r.value.displayName).not.toContain("\u202E");
    }
  });
});

describe("ADVERSARIAL E: BUG-049 DTO no raw state", () => {
  it("a clean DTO exports successfully", async () => {
    const dto = buildDiagnosticDto({
      adapterVersion: "1",
      workflow: "IDLE",
      errorCodes: ["GISO-TEST-001"],
      rowCount: 5,
      resolvedCount: 3,
      unresolvedCount: 2,
      duplicateCount: 0,
      weakFingerprintCount: 0,
      evidenceCodes: [],
      timings: { x: 100 },
    });
    const blob = await createDiagnosticBlob(dto);
    const text = await blob.text();
    expect(text).not.toContain("@");
    expect(text).not.toContain("data-thread-id");
  });
});

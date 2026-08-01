// Diagnostic export tests (BUG-049/065). Proves the explicit DTO model:
// only numbers/booleans/codes are accepted; fingerprints, emails, thread-IDs,
// and raw state objects are never in the export.
import { describe, expect, it } from "vitest";
import { buildDiagnosticDto, createDiagnosticBlob } from "@/privacy/diagnostic-export";
describe("buildDiagnosticDto (BUG-049)", () => {
  it("builds a clean DTO from allowlisted fields", () => {
    const dto = buildDiagnosticDto({
      adapterVersion: "2026.07.1",
      workflow: "RESULTS_READY",
      errorCodes: ["GISO-SEARCH-TIMEOUT-001"],
      rowCount: 42,
      resolvedCount: 40,
      unresolvedCount: 2,
      duplicateCount: 1,
      weakFingerprintCount: 0,
      evidenceCodes: ["GISO-STATE-ILLEGAL-001"],
      timings: { analyze: 1200 },
    });
    expect(dto.schemaVersion).toBe(1);
    expect(dto.rowCount).toBe(42);
    expect(dto.errorCodes).toEqual(["GISO-SEARCH-TIMEOUT-001"]);
  });
  it("filters out non-code strings from errorCodes", () => {
    const dto = buildDiagnosticDto({
      adapterVersion: "1",
      workflow: "IDLE",
      errorCodes: ["GISO-VALID-001", "not-a-code", "alice@example.com", ""],
      rowCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      duplicateCount: 0,
      weakFingerprintCount: 0,
      evidenceCodes: [],
      timings: {},
    });
    expect(dto.errorCodes).toEqual(["GISO-VALID-001"]);
  });
});
describe("createDiagnosticBlob (BUG-049 leak scan)", () => {
  it("produces a clean JSON blob", async () => {
    const dto = buildDiagnosticDto({
      adapterVersion: "1",
      workflow: "IDLE",
      errorCodes: [],
      rowCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      duplicateCount: 0,
      weakFingerprintCount: 0,
      evidenceCodes: [],
      timings: {},
    });
    const blob = await createDiagnosticBlob(dto);
    expect(blob.type).toBe("application/json");
    const text = await blob.text();
    expect(text).not.toContain("@");
    expect(text).toContain("schemaVersion");
  });
  it("rejects a DTO that somehow contains a thread-ID fingerprint", async () => {
    // Manually craft a malicious DTO (bypassing buildDiagnosticDto).
    const malicious = {
      schemaVersion: 1,
      adapterVersion: "1",
      workflow: "IDLE",
      errorCodes: ["attr:data-thread-id:FMfcggx123"],
      rowCount: 0,
      resolvedCount: 0,
      unresolvedCount: 0,
      duplicateCount: 0,
      weakFingerprintCount: 0,
      evidenceCodes: [],
      timings: {},
    };
    // The leak scan catches the fingerprint pattern.
    await expect(createDiagnosticBlob(malicious)).rejects.toThrow(/leak scan/u);
  });
});

// Diagnostic export (spec §57.4, report BUG-049/065).
//
// BUG-049: the export now uses an EXPLICIT DTO (DiagnosticExportV1) with only
// numbers, booleans, and short code strings — no raw analysis objects, no
// fingerprints, no thread/message IDs, no names, no emails, no queries.
// The previous recursive redaction of arbitrary App state is replaced by a
// strict allowlist builder.
//
// BUG-065: the download link is now appended to the document before clicking,
// and the blob URL is revoked after a longer delay (not setTimeout 0).
const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

export interface DiagnosticExportV1 {
  readonly schemaVersion: 1;
  readonly adapterVersion: string;
  readonly workflow: string;
  readonly errorCodes: readonly string[];
  readonly rowCount: number;
  readonly resolvedCount: number;
  readonly unresolvedCount: number;
  readonly duplicateCount: number;
  readonly weakFingerprintCount: number;
  readonly evidenceCodes: readonly string[];
  readonly timings: Readonly<Record<string, number>>;
}

// BUG-049: forbidden patterns that must NEVER appear in the serialized export.
const FORBIDDEN_AFTER_BUILD = [
  /@/u,
  /%40/iu,
  /mailto:/iu,
  /in:inbox\s+["']?from:/iu,
  /data-thread-id/u,
  /data-message-id/u,
  /data-legacy-thread-id/u,
  /attr:data-/u, // fingerprint values
];

/**
 * GATE-005: coerce a numeric field to a safe non-negative integer for the DTO.
 * JSON.stringify turns NaN/Infinity into `null`, which would change the shape of
 * the export (a nullable count instead of a number) and could trip downstream
 * consumers. Math.floor alone does not reject non-finite values (Math.floor of
 * Infinity is still Infinity, which serializes to null), so guard with
 * Number.isFinite first and fall back to 0 for anything non-finite or negative.
 */
function safeInt(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/**
 * Build a strict diagnostic DTO from allowlisted technical fields only.
 * BUG-049: no raw analysis objects are passed; only pre-extracted numbers,
 * booleans, and short code strings.
 */
export function buildDiagnosticDto(fields: {
  readonly adapterVersion: string;
  readonly workflow: string;
  readonly errorCodes: readonly string[];
  readonly rowCount: number;
  readonly resolvedCount: number;
  readonly unresolvedCount: number;
  readonly duplicateCount: number;
  readonly weakFingerprintCount: number;
  readonly evidenceCodes: readonly string[];
  readonly timings: Readonly<Record<string, number>>;
}): DiagnosticExportV1 {
  // GATE-005: validate workflow and adapterVersion before they enter the DTO.
  const sanitizedWorkflow = /^[A-Z_]+$/u.test(fields.workflow) ? fields.workflow : "UNKNOWN";
  const sanitizedVersion = /^\d{4}\.\d{2}\.\d+$/u.test(fields.adapterVersion)
    ? fields.adapterVersion
    : "unknown";
  // GATE-005: sanitize timing keys (alphanumeric) and values (finite, non-negative).
  const sanitizedTimings: Record<string, number> = {};
  for (const [key, value] of Object.entries(fields.timings)) {
    if (
      /^[a-zA-Z0-9_]+$/u.test(key) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      sanitizedTimings[key] = value;
    }
  }
  return {
    schemaVersion: 1,
    adapterVersion: sanitizedVersion,
    workflow: sanitizedWorkflow,
    // Sanitize: only allow short alphanumeric/dash codes.
    errorCodes: fields.errorCodes.filter((c) => /^GISO-[A-Z0-9-]+$/u.test(c)).slice(0, 50),
    // GATE-005: safeInt rejects non-finite numbers (which would serialize to
    // null) and clamps negatives to 0.
    rowCount: safeInt(fields.rowCount),
    resolvedCount: safeInt(fields.resolvedCount),
    unresolvedCount: safeInt(fields.unresolvedCount),
    duplicateCount: safeInt(fields.duplicateCount),
    weakFingerprintCount: safeInt(fields.weakFingerprintCount),
    evidenceCodes: fields.evidenceCodes.filter((c) => /^GISO-[A-Z0-9-]+$/u.test(c)).slice(0, 50),
    timings: sanitizedTimings,
  };
}

export function createDiagnosticBlob(dto: DiagnosticExportV1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      resolve(createDiagnosticBlobSync(dto));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function createDiagnosticBlobSync(dto: DiagnosticExportV1): Blob {
  const json = `${JSON.stringify(dto, null, 2)}\n`;
  // BUG-049: post-serialize scan for forbidden content.
  const leak = FORBIDDEN_AFTER_BUILD.find((pattern) => pattern.test(json));
  if (leak) throw new Error(`GISO diagnostic export failed leak scan: ${leak.source}`);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MAX_EXPORT_BYTES) throw new Error("GISO diagnostic export exceeds 2 MB");
  return new Blob([bytes], { type: "application/json" });
}

// Part of the privacy module's public API. The diagnostics UI button is
// currently disconnected, so this is not called from the UI; it is kept so it
// can be re-connected when diagnostics are re-enabled. buildDiagnosticDto and
// createDiagnosticBlob (above) remain exercised by unit tests.
export function downloadDiagnosticBlob(blob: Blob, now = new Date()): void {
  const stamp = now
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `giso-diagnostics-${stamp}.json`;
  link.rel = "noopener";
  // BUG-065: append to document so the download is reliable across browsers.
  document.body.append(link);
  link.click();
  link.remove();
  // BUG-065: revoke after a longer delay (not setTimeout 0) so the download
  // has time to initiate.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

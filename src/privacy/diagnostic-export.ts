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
  return {
    schemaVersion: 1,
    adapterVersion: fields.adapterVersion,
    workflow: fields.workflow,
    // Sanitize: only allow short alphanumeric/dash codes.
    errorCodes: fields.errorCodes.filter((c) => /^GISO-[A-Z0-9-]+$/u.test(c)).slice(0, 50),
    rowCount: Math.max(0, Math.floor(fields.rowCount)),
    resolvedCount: Math.max(0, Math.floor(fields.resolvedCount)),
    unresolvedCount: Math.max(0, Math.floor(fields.unresolvedCount)),
    duplicateCount: Math.max(0, Math.floor(fields.duplicateCount)),
    weakFingerprintCount: Math.max(0, Math.floor(fields.weakFingerprintCount)),
    evidenceCodes: fields.evidenceCodes.filter((c) => /^GISO-[A-Z0-9-]+$/u.test(c)).slice(0, 50),
    timings: fields.timings,
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

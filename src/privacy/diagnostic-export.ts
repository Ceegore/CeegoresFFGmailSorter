// Diagnostic export: redact, serialize, post-scan for leaks, cap size (spec §57.4, A.7).
import { redactUnknown } from "./redact";

const FORBIDDEN_AFTER_REDACTION = [
  /@/u,
  /%40/iu,
  /mailto:/iu,
  /in:inbox\s+["']?from:/iu,
  /(?:textContent|outerHTML|subject|snippet)\s*[=:]\s*(?!\[REDACTED\])/iu,
  /mail\.google\.com\/.*(?:search|query|#search)/iu,
];
const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

export async function createDiagnosticBlob(payload: unknown): Promise<Blob> {
  const redacted = await redactUnknown(payload);
  const json = `${JSON.stringify(redacted, null, 2)}\n`;
  const leak = FORBIDDEN_AFTER_REDACTION.find((pattern) => pattern.test(json));
  if (leak) throw new Error(`GISO diagnostic export failed redaction gate: ${leak.source}`);
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
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

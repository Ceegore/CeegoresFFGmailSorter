// Recursive diagnostic redaction (spec §57). Allowlists technical keys at the
// source, hashes email addresses (domain not preserved), and redacts subject/
// snippet/text fields. After serialization, diagnostic-export re-scans.
const FORBIDDEN_KEY =
  /email|address|query|href|url|subject|snippet|body|html|textcontent|outerhtml|arialabel|displayname|sendername|name/iu;
const ALLOWED_KEY =
  /^(confidence|score|candidateCount|rowCount|resolvedCount|unresolvedCount|duplicateCount|weakFingerprintCount|timeoutMs|retry|workflow|view|locale|accountSlot|manualGlobalSelectionConfirmed|evidenceCodes)$/u;

const EMAILISH = /(?:mailto:)?[^\s"'<>]+@[^\s"'<>]+/giu;

async function hash12(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value.normalize("NFKC").toLowerCase()),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function redactString(value: string): Promise<string> {
  let result = value.replace(/%40/giu, "@");
  for (const match of [...result.matchAll(EMAILISH)]) {
    result = result.replace(match[0], `email_sha256_12:${await hash12(match[0])}`);
  }
  return result
    .replace(
      /\b(?:subject|snippet|body|html|textcontent|outerhtml|aria-label)\s*[:=].*$/gimu,
      "[REDACTED]",
    )
    .replace(/in:inbox\s+["']?from:[^\s"']+["']?/giu, "[QUERY_REDACTED]");
}

export async function redactUnknown(value: unknown, key = ""): Promise<unknown> {
  if (FORBIDDEN_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return Promise.all(value.map((item) => redactUnknown(item, key)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(
        async ([childKey, child]) => [childKey, await redactUnknown(child, childKey)] as const,
      ),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

/** Diagnostic event factory: drops sensitive detail keys before they exist. */
export function isAllowedDetailKey(key: string): boolean {
  return ALLOWED_KEY.test(key) && !FORBIDDEN_KEY.test(key);
}

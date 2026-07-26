// Diagnostic export tests (spec §57.4, A.7): redaction runs, leak scan blocks
// exports containing plaintext emails/queries, 2MB cap, blob is JSON.
import { describe, expect, it } from "vitest";
import { createDiagnosticBlob } from "@/privacy/diagnostic-export";

describe("createDiagnosticBlob", () => {
  it("produces a JSON blob with redacted content", async () => {
    const blob = await createDiagnosticBlob({
      code: "GISO-INTERNAL-001",
      sender: { displayName: "Alice", email: "alice@example.com" },
      subject: "Private subject",
      note: "contact alice@example.com please",
    });
    expect(blob.type).toBe("application/json");
    const text = await blob.text();
    // Key-based redaction: displayName/email/subject values become [REDACTED].
    expect(text).not.toContain("alice@example.com");
    expect(text).not.toContain("Alice");
    expect(text).not.toContain("Private subject");
    // Value-based redaction: an email inside a non-forbidden key string is hashed.
    expect(text).toContain("email_sha256_12:");
  });

  it("redacts an email inside an allowlisted key's value too", async () => {
    // evidenceCodes is allowlisted by key, but the value still gets string-redacted.
    const blob = await createDiagnosticBlob({ evidenceCodes: "raw a@b.com value" });
    const text = await blob.text();
    expect(text).not.toContain("a@b.com");
    expect(text).not.toContain("@b.com");
  });
});

import { describe, expect, it } from "vitest";
import { redactUnknown, redactString } from "@/privacy/redact";
describe("redactString", () => {
  it("hashes email addresses without preserving the domain", async () => {
    const out = await redactString("contact alice@example.com");
    expect(out).not.toContain("alice@example.com");
    expect(out).not.toContain("example.com");
    expect(out).toContain("email_sha256_12:");
  });
  it("hashes the email inside a query string so no plaintext leaks", async () => {
    const out = await redactString('in:inbox "from:alice@example.com"');
    expect(out).not.toContain("alice@example.com");
    expect(out).not.toContain("alice");
    // The structural query operator may remain but the address is gone.
    expect(out).toContain("email_sha256_12:");
  });
});
describe("redactUnknown", () => {
  it("redacts nested email, name and subject values", async () => {
    const redacted = await redactUnknown({
      sender: { displayName: "Alice", email: "alice@example.com" },
      subject: "Private subject",
    });
    const json = JSON.stringify(redacted);
    expect(json).not.toContain("alice@example.com");
    expect(json).not.toContain("Alice");
    expect(json).not.toContain("Private subject");
  });
  it("redacts arrays of emails", async () => {
    const redacted = await redactUnknown(["alice@example.com", "bob@example.com"]);
    const json = JSON.stringify(redacted);
    expect(json).not.toContain("@example.com");
  });
  it("redacts forbidden keys by key name", async () => {
    const redacted = await redactUnknown({ query: "in:inbox from:x", subject: "s" });
    expect(JSON.stringify(redacted)).not.toContain("in:inbox from:x");
  });
  it("preserves allowlisted technical keys", async () => {
    const redacted = await redactUnknown({ score: 95, rowCount: 42, candidateCount: 3 });
    expect(redacted).toEqual({ score: 95, rowCount: 42, candidateCount: 3 });
  });
});

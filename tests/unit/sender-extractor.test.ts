// Sender extractor tests (spec §14, §52): attribute sources, confidence levels,
// conflict detection, visible-text-only fallback, unresolved cases.
import { describe, expect, it } from "vitest";
import { extractSenderFromRow } from "@/analyzer/sender-extractor";

function row(attrs: Record<string, string> = {}, child?: HTMLElement): HTMLElement {
  const r = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) r.setAttribute(k, v);
  if (child) r.append(child);
  document.body.append(r);
  return r;
}

function span(attrs: Record<string, string>, text = "Sender"): HTMLElement {
  const s = document.createElement("span");
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  s.textContent = text;
  return s;
}

describe("extractSenderFromRow", () => {
  it("email attribute => high confidence", () => {
    const r = row({}, span({ email: "alice@example.com" }));
    const s = extractSenderFromRow(r);
    expect(s.confidence).toBe("high");
    expect(s.normalizedEmail).toBe("alice@example.com");
    expect(s.source).toBe("email-attribute");
  });

  it("data-hovercard-id on child => high confidence", () => {
    const r = row({}, span({ "data-hovercard-id": "billing@example.org" }, "Rechnung"));
    const s = extractSenderFromRow(r);
    expect(s.confidence).toBe("high");
    expect(s.normalizedEmail).toBe("billing@example.org");
    expect(s.source).toBe("hovercard-id");
  });

  it("data-email => high confidence", () => {
    const r = row({}, span({ "data-email": "news@example.com" }));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("news@example.com");
    expect(s.source).toBe("data-email");
  });

  it("title with email => medium confidence", () => {
    const r = row({}, span({ title: "Alice <alice@example.com>" }));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("alice@example.com");
    expect(["medium", "high"]).toContain(s.confidence);
    expect(s.source).toBe("title");
  });

  it("aria-label with email => medium confidence", () => {
    const r = row({}, span({ "aria-label": "bob@example.com" }));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("bob@example.com");
    expect(["medium", "high"]).toContain(s.confidence);
    expect(s.source).toBe("aria-label");
  });

  it("conflicting emails from two sources => unresolved conflict", () => {
    const child = span({ email: "a@example.com" });
    child.setAttribute("data-email", "b@example.com");
    const r = row({}, child);
    const s = extractSenderFromRow(r);
    expect(s.confidence).toBe("unresolved");
    expect(s.diagnostics).toContain("GISO-SENDER-CONFLICT-001");
  });

  it("same email from two sources => resolved (no conflict)", () => {
    const child = span({ email: "a@example.com" });
    child.setAttribute("data-email", "a@example.com");
    const r = row({}, child);
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("a@example.com");
    expect(s.confidence).toBe("high");
  });

  it("no email, only visible text => low confidence, never global-actionable", () => {
    const r = row({}, span({}, "Just A Name"));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBeNull();
    expect(s.confidence).toBe("low");
    expect(s.source).toBe("visible-text");
  });

  it("empty row => unresolved", () => {
    const r = row({});
    const s = extractSenderFromRow(r);
    expect(s.confidence).toBe("unresolved");
    expect(s.normalizedEmail).toBeNull();
  });

  it("falls back to a lower-confidence observation's display name when high has none", () => {
    // email attribute "a@example.com" has no display name; title "Beta <a@...>"
    // provides one. The extractor uses the high-confidence email but borrows the
    // display name from the title observation.
    const child = span({ email: "a@example.com" }, "Alpha");
    child.setAttribute("title", "Beta <a@example.com>");
    const r = row({}, child);
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("a@example.com");
    expect(s.displayName).toBe("Beta");
  });
});

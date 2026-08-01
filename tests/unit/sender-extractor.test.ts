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

  it("title on the sender cell => medium confidence", () => {
    // BUG-012: title must be on the sender cell (element with email attr), not
    // an arbitrary descendant.
    const r = row({}, span({ email: "alice@example.com", title: "Alice <alice@example.com>" }));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("alice@example.com");
    expect(["medium", "high"]).toContain(s.confidence);
  });

  it("aria-label on the sender cell => medium confidence", () => {
    const r = row({}, span({ email: "bob@example.com", "aria-label": "bob@example.com" }));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("bob@example.com");
    expect(["medium", "high"]).toContain(s.confidence);
  });

  it("BUG-012: title on a non-sender element is ignored", () => {
    // The title is on a subject-like span, NOT the sender cell.
    const r = row({}, span({ email: "real@example.com" }));
    const subjectSpan = document.createElement("span");
    subjectSpan.setAttribute("title", "fake@other.com");
    r.append(subjectSpan);
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("real@example.com");
    expect(s.source).not.toBe("title");
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

  it("BUG-041: no email, only visible text => unresolved, no textContent stored", () => {
    const r = row({}, span({}, "Just A Name"));
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBeNull();
    expect(s.confidence).toBe("unresolved");
    expect(s.displayName).toBeNull(); // BUG-041: never store row text
    expect(s.diagnostics).toContain("GISO-SENDER-UNRESOLVED-001");
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

  it("ITI-015: multi-participant thread with two distinct sender elements => conflict", () => {
    // ITI-015: a thread with multiple participants renders more than one sender
    // element. Previously only the first match was read (querySelector), so the
    // row was misattributed to a single participant. Now every [email] is read
    // and the conflict guard (uniqueEmails.size > 1) fires correctly.
    const first = span({ email: "alice@example.com" }, "Alice");
    const second = span({ email: "bob@example.com" }, "Bob");
    const r = row({}, first);
    r.append(second);
    const s = extractSenderFromRow(r);
    expect(s.confidence).toBe("unresolved");
    expect(s.diagnostics).toContain("GISO-SENDER-CONFLICT-001");
  });

  it("ITI-015: same email repeated across multiple sender elements => resolved", () => {
    // Two sender elements carrying the SAME address must NOT be treated as a
    // conflict (e.g. one in the avatar, one in the name span).
    const first = span({ email: "news@example.com" }, "News");
    const second = span({ email: "news@example.com" }, "News");
    const r = row({}, first);
    r.append(second);
    const s = extractSenderFromRow(r);
    expect(s.normalizedEmail).toBe("news@example.com");
    expect(s.confidence).toBe("high");
  });

  it("ITI-015: multiple distinct data-hovercard-id sources => conflict", () => {
    const first = span({ "data-hovercard-id": "billing@example.org" }, "A");
    const second = span({ "data-hovercard-id": "sales@example.org" }, "B");
    const r = row({}, first);
    r.append(second);
    const s = extractSenderFromRow(r);
    expect(s.confidence).toBe("unresolved");
    expect(s.diagnostics).toContain("GISO-SENDER-CONFLICT-001");
  });
});

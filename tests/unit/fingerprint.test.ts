import { describe, expect, it } from "vitest";
import { fingerprintRow } from "@/analyzer/fingerprint";

describe("fingerprintRow", () => {
  it("uses a stable gmail thread id when present", () => {
    const row = document.createElement("div");
    row.setAttribute("data-thread-id", "thread-a");
    expect(fingerprintRow(row, 0, "run1")).toEqual({
      value: "attr:data-thread-id:thread-a",
      strength: "stable",
    });
  });
  it("falls back to a weak opaque fingerprint when no stable id exists", () => {
    const row = document.createElement("div");
    const fp = fingerprintRow(row, 3, "runX");
    expect(fp.strength).toBe("weak");
    expect(fp.value).toBe("weak:runX:3");
  });
  it("weak fingerprints never embed row text or aria-label", () => {
    const row = document.createElement("div");
    row.setAttribute("aria-label", "Secret Subject Line");
    row.textContent = "private snippet";
    const fp = fingerprintRow(row, 1, "run1");
    expect(fp.value).not.toContain("Secret");
    expect(fp.value).not.toContain("private");
  });
});

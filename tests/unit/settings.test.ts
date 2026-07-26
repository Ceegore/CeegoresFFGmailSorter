import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/settings/defaults";
import { validateSettings } from "@/settings/storage";

describe("validateSettings", () => {
  it("returns defaults for non-object input", () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings("oops")).toEqual(DEFAULT_SETTINGS);
  });
  it("drops unknown keys and clamps invalid structure to defaults", () => {
    expect(
      validateSettings({
        schemaVersion: 99,
        overlayPosition: { top: -1, right: "bad" },
        diagnosticsEnabled: true,
        senderHistory: ["private@example.com"],
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      diagnosticsEnabled: true,
    });
  });
  it("keeps valid overlay position", () => {
    const out = validateSettings({
      overlayPosition: { top: 120, right: 24 },
      diagnosticsEnabled: false,
      autoOpenMoveMenu: false,
    });
    expect(out.overlayPosition).toEqual({ top: 120, right: 24 });
    expect(out.autoOpenMoveMenu).toBe(false);
  });
  it("non-boolean flags fall back to defaults", () => {
    const out = validateSettings({ diagnosticsEnabled: "yes", autoOpenMoveMenu: 1 });
    expect(out.diagnosticsEnabled).toBe(false);
    expect(out.autoOpenMoveMenu).toBe(true);
  });
});

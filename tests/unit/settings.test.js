import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/settings/defaults";
import { validateSettings } from "@/settings/storage";
describe("validateSettings", () => {
  it("returns defaults for non-object input", () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings("oops")).toEqual(DEFAULT_SETTINGS);
  });
  it("BUG-059: drops unknown keys (diagnosticsEnabled/autoOpenMoveMenu removed)", () => {
    expect(
      validateSettings({
        schemaVersion: 99,
        overlayPosition: { top: -1, right: "bad" },
        diagnosticsEnabled: true,
        autoOpenMoveMenu: false,
        senderHistory: ["private@example.com"],
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
    });
  });
  it("keeps valid overlay position", () => {
    const out = validateSettings({
      overlayPosition: { top: 120, right: 24 },
    });
    expect(out.overlayPosition).toEqual({ top: 120, right: 24 });
  });
  it("rejects negative positions (falls back to defaults)", () => {
    const out = validateSettings({ overlayPosition: { top: -5, right: 10 } });
    expect(out.overlayPosition).toEqual(DEFAULT_SETTINGS.overlayPosition);
  });
});

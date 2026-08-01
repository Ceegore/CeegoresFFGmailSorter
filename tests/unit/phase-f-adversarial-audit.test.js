// PHASE F ADVERSARIAL AUDIT: probes contrast (BUG-057), settings (BUG-059),
// error translation (BUG-022), diagnostics removal (BUG-016).
import { beforeEach, describe, expect, it } from "vitest";
beforeEach(() => {
  document.querySelectorAll("#giso-extension-root").forEach((el) => {
    el.remove();
  });
});
// ---- BUG-057: dark-mode contrast variable exists ----
describe("ADVERSARIAL F: BUG-057 dark-mode contrast", () => {
  it("dist/content.js contains --giso-primary-text variable", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(
      path.resolve(import.meta.dirname, "..", "..", "src", "ui", "styles.css"),
      "utf8",
    );
    expect(css).toContain("--giso-primary-text: #202124");
    expect(css).toContain("--giso-primary-text: #ffffff");
    expect(css).toContain("var(--giso-primary-text)");
    // The old hardcoded #fff on primary buttons must be gone.
    expect(css).not.toMatch(/\.giso-btn--primary[\s\S]*color:\s*#fff/u);
  });
});
// ---- BUG-059: settings only have overlayPosition ----
describe("ADVERSARIAL F: BUG-059 settings cleanup", () => {
  it("StoredSettingsV1 has only schemaVersion + overlayPosition", async () => {
    const { DEFAULT_SETTINGS } = await import("@/settings/defaults");
    const keys = Object.keys(DEFAULT_SETTINGS);
    expect(keys).toEqual(["schemaVersion", "overlayPosition"]);
  });
  it("validateSettings drops diagnosticsEnabled and autoOpenMoveMenu", async () => {
    const { validateSettings } = await import("@/settings/storage");
    const result = validateSettings({
      overlayPosition: { top: 10, right: 20 },
      diagnosticsEnabled: true,
      autoOpenMoveMenu: false,
    });
    expect(result).not.toHaveProperty("diagnosticsEnabled");
    expect(result).not.toHaveProperty("autoOpenMoveMenu");
  });
});
// ---- BUG-016: no diagnostics button in IDLE ----
describe("ADVERSARIAL F: BUG-016 diagnostics button removed", () => {
  it("IDLE view has NO giso-diagnostics button", async () => {
    const { renderApp } = await import("@/ui/render");
    const { ensureOverlayHost } = await import("@/ui/overlay-host");
    const { createAppController } = await import("@/app/controller");
    const { createStore } = await import("@/app/store");
    const { reduceAppState } = await import("@/app/state-machine");
    const { initialState } = await import("@/app/initial-state");
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    const { shadow } = ensureOverlayHost();
    renderApp(shadow, { ...initialState, overlayVisible: true }, c);
    expect(shadow.querySelector('[data-testid="giso-diagnostics"]')).toBeNull();
    // The analyze and close buttons must still be present.
    expect(shadow.querySelector('[data-testid="giso-analyze"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-close"]')).not.toBeNull();
    c.dispose();
  });
});
// ---- BUG-022: error view shows translated text, not raw keys ----
describe("ADVERSARIAL F: BUG-022 error text translation", () => {
  it("error with userMessageKey 'gmailNotReady' shows translated text", async () => {
    const { renderApp } = await import("@/ui/render");
    const { ensureOverlayHost } = await import("@/ui/overlay-host");
    const { createAppController } = await import("@/app/controller");
    const { createStore } = await import("@/app/store");
    const { reduceAppState } = await import("@/app/state-machine");
    const { initialState } = await import("@/app/initial-state");
    const { de } = await import("@/i18n/de");
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    const { shadow } = ensureOverlayHost();
    renderApp(
      shadow,
      {
        ...initialState,
        overlayVisible: true,
        workflow: "ERROR",
        error: {
          code: "GISO-SHELL-001",
          userMessageKey: "gmailNotReady",
          technicalMessage: "shell not detected",
          recoverable: true,
        },
      },
      c,
    );
    const errorText = shadow.querySelector(".giso-error")?.textContent ?? "";
    // Must contain the translated text, NOT the raw key.
    expect(errorText).toContain(de.gmailNotReady);
    expect(errorText).not.toContain("gmailNotReady"); // the raw key string
    c.dispose();
  });
  it("error with unknown userMessageKey falls back to safe generic", async () => {
    const { renderApp } = await import("@/ui/render");
    const { ensureOverlayHost } = await import("@/ui/overlay-host");
    const { createAppController } = await import("@/app/controller");
    const { createStore } = await import("@/app/store");
    const { reduceAppState } = await import("@/app/state-machine");
    const { initialState } = await import("@/app/initial-state");
    const { de } = await import("@/i18n/de");
    const store = createStore(initialState, reduceAppState, (s) => [s.workflow]);
    const c = createAppController(store);
    const { shadow } = ensureOverlayHost();
    renderApp(
      shadow,
      {
        ...initialState,
        overlayVisible: true,
        workflow: "ERROR",
        error: {
          code: "GISO-INTERNAL-001",
          userMessageKey: "nonExistentKey123",
          technicalMessage: "x",
          recoverable: true,
        },
      },
      c,
    );
    const errorText = shadow.querySelector(".giso-error")?.textContent ?? "";
    expect(errorText).toContain(de.unsafeState);
    expect(errorText).not.toContain("nonExistentKey123");
    c.dispose();
  });
});

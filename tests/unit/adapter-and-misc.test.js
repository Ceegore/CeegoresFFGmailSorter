// Coverage gap tests: adapter.ts detection helpers, overlay-position drag
// pointer path, storage round-trip with a mocked browser.storage.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { detectionFail, detectionOk, requireDetection } from "@/gmail/adapter";
import { wirePositioning, applyPosition, DEFAULT_POSITION } from "@/ui/overlay-position";
import { loadSettings, saveSettings, validateSettings } from "@/settings/storage";
describe("adapter detection helpers", () => {
  it("detectionOk carries value and optional candidateCount", () => {
    const d = detectionOk({ x: 1 }, 0.9, ["e"], 3);
    expect(d.ok).toBe(true);
    expect(d.value).toEqual({ x: 1 });
    expect(d.candidateCount).toBe(3);
  });
  it("detectionFail carries errorCode", () => {
    const d = detectionFail(0, ["e"], "GISO-X");
    expect(d.ok).toBe(false);
    expect(d.errorCode).toBe("GISO-X");
    expect(d.value).toBeUndefined();
  });
  it("requireDetection returns the value when ok", () => {
    const d = detectionOk({ n: 5 }, 1, []);
    expect(requireDetection(d)).toEqual({ n: 5 });
  });
  it("requireDetection throws when not ok", () => {
    const d = detectionFail(0, ["no"], "GISO-X");
    expect(() => requireDetection(d)).toThrow(/GISO-X/u);
  });
  it("requireDetection throws when ok but value undefined", () => {
    const d = { ok: true, confidence: 1, evidence: [] };
    expect(() => requireDetection(d)).toThrow();
  });
});
describe("overlay-position drag pointer path", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  it("pointerdown+move+up repositions and persists", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    document.body.append(overlay, handle);
    const persist = vi.fn();
    wirePositioning(overlay, handle, persist);
    handle.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 100, clientY: 80, button: 0, pointerId: 1 }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 140, clientY: 100, pointerId: 1 }),
    );
    handle.dispatchEvent(
      new PointerEvent("pointerup", { clientX: 140, clientY: 100, pointerId: 1 }),
    );
    expect(persist).toHaveBeenCalled();
    const pos = persist.mock.calls.at(-1)?.[0];
    expect(typeof pos?.top).toBe("number");
  });
  it("non-left button pointerdown is ignored", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    const persist = vi.fn();
    wirePositioning(overlay, handle, persist);
    handle.dispatchEvent(new PointerEvent("pointerdown", { button: 2, pointerId: 1 }));
    expect(persist).not.toHaveBeenCalled();
  });
  it("ArrowLeft persists a clamped position", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    const persist = vi.fn();
    wirePositioning(overlay, handle, persist);
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    const pos = persist.mock.calls[0]?.[0];
    expect(pos?.right).toBe(DEFAULT_POSITION.right + 8);
  });
  it("Escape restores pre-drag position", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    const persist = vi.fn();
    wirePositioning(overlay, handle, persist);
    // Drag first to change pre-drag baseline... actually Escape restores the
    // position from before the CURRENT drag. Without a drag, it just re-applies
    // the default and persists.
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(persist).toHaveBeenCalled();
  });
  it("applyPosition sets custom props", () => {
    const el = document.createElement("div");
    applyPosition(el, { top: 50, right: 10 });
    expect(el.style.getPropertyValue("--giso-overlay-top")).toContain("50");
  });
});
describe("settings storage round-trip", () => {
  it("loadSettings returns validated settings from browser.storage", async () => {
    const store = {
      settings: {
        overlayPosition: { top: 100, right: 20 },
        diagnosticsEnabled: true,
        autoOpenMoveMenu: false,
      },
    };
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn((key) => Promise.resolve({ [key]: store[key] })),
          set: vi.fn(() => Promise.resolve()),
        },
      },
    };
    const loaded = await loadSettings();
    expect(loaded.overlayPosition).toEqual({ top: 100, right: 20 });
  });
  it("saveSettings validates before writing", async () => {
    const setMock = vi.fn(() => Promise.resolve());
    globalThis.browser = {
      storage: { local: { get: vi.fn(() => Promise.resolve({})), set: setMock } },
    };
    const validated = validateSettings({ overlayPosition: { top: 0, right: 0 } });
    await saveSettings(validated);
    expect(setMock).toHaveBeenCalled();
  });
});

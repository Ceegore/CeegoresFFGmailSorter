// Overlay positioning tests (spec §56.5): clamp keeps header visible, default
// position, nudge constants, applyPosition sets CSS vars. Drag/keyboard
// interaction is exercised via pointer/key dispatch.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPosition,
  clampPosition,
  DEFAULT_POSITION,
  NUDGE_PX,
  NUDGE_PX_FAST,
  wirePositioning,
} from "@/ui/overlay-position";
beforeEach(() => {
  document.body.innerHTML = "";
});
describe("clampPosition (spec §56.5)", () => {
  it("keeps the header visible (top >= 0)", () => {
    expect(clampPosition({ top: -100, right: 16 }, 1440, 900).top).toBe(0);
  });
  it("allows moving the overlay fully left while header stays in viewport", () => {
    const pos = clampPosition({ top: 80, right: 1500 }, 1440, 900);
    expect(pos.right).toBeGreaterThanOrEqual(-(1440 - 24));
  });
  it("does not clamp the default position", () => {
    expect(clampPosition(DEFAULT_POSITION, 1440, 900)).toEqual(DEFAULT_POSITION);
  });
});
describe("applyPosition", () => {
  it("sets the CSS custom properties", () => {
    const el = document.createElement("div");
    applyPosition(el, { top: 120, right: 24 });
    expect(el.style.getPropertyValue("--giso-overlay-top")).toBe("120px");
    expect(el.style.getPropertyValue("--giso-overlay-right")).toBe("24px");
  });
});
describe("nudge constants (spec §56.5)", () => {
  it("arrow = 8px, shift+arrow = 32px", () => {
    expect(NUDGE_PX).toBe(8);
    expect(NUDGE_PX_FAST).toBe(32);
  });
});
describe("wirePositioning keyboard", () => {
  it("ArrowDown moves top by 8px and persists", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    const persist = vi.fn();
    wirePositioning(overlay, handle, persist);
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(persist).toHaveBeenCalled();
    const pos = persist.mock.calls[0]?.[0];
    expect(pos?.top).toBe(DEFAULT_POSITION.top + NUDGE_PX);
  });
  it("Shift+ArrowUp moves top by -32px", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    const persist = vi.fn();
    wirePositioning(overlay, handle, persist);
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", shiftKey: true, bubbles: true }),
    );
    const pos = persist.mock.calls[0]?.[0];
    expect(pos?.top).toBe(DEFAULT_POSITION.top - NUDGE_PX_FAST);
  });
  it("unsubscribes cleanly", () => {
    const overlay = document.createElement("div");
    const handle = document.createElement("button");
    const persist = vi.fn();
    const off = wirePositioning(overlay, handle, persist);
    off();
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(persist).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { ensureOverlayHost } from "@/ui/overlay-host";
import { renderApp } from "@/ui/render";
import { createAppController } from "@/app/controller";
import { initialState } from "@/app/initial-state";
import { createStore } from "@/app/store";
import { reduceAppState } from "@/app/state-machine";
function setupController() {
  const store = createStore(initialState, reduceAppState);
  return createAppController(store);
}
describe("renderApp brand-credit guarantee", () => {
  beforeEach(() => {
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
  });
  it("renders exactly one brand credit per render in IDLE", () => {
    const { shadow } = ensureOverlayHost();
    renderApp(shadow, initialState, setupController());
    expect(shadow.querySelectorAll('[data-testid="brand-credit"]')).toHaveLength(1);
    expect(shadow.querySelector('[data-testid="brand-credit"]')?.textContent).toBe(
      "made by Ceegore",
    );
  });
  it("does not duplicate the credit across re-renders", () => {
    const { shadow } = ensureOverlayHost();
    const controller = setupController();
    renderApp(shadow, initialState, controller);
    renderApp(shadow, initialState, controller);
    renderApp(shadow, initialState, controller);
    expect(shadow.querySelectorAll('[data-testid="brand-credit"]')).toHaveLength(1);
  });
  it("hides the overlay element when overlayVisible is false", () => {
    const { shadow } = ensureOverlayHost();
    const hidden = { ...initialState, overlayVisible: false };
    renderApp(shadow, hidden, setupController());
    const overlay = shadow.querySelector(".giso-overlay");
    expect(overlay?.style.display).toBe("none");
  });
  it("renders the analyze button in IDLE", () => {
    const { shadow } = ensureOverlayHost();
    renderApp(shadow, initialState, setupController());
    expect(shadow.querySelector('[data-testid="giso-analyze"]')).not.toBeNull();
  });
});

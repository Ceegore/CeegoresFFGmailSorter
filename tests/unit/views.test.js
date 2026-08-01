// Views rendering tests: exercise every workflow state's view body to drive
// coverage of src/ui/views.ts and confirm the right controls/data-testids appear
// in each state. Uses a fake controller to avoid effect orchestration.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "@/ui/render";
import { ensureOverlayHost } from "@/ui/overlay-host";
import { createAppController } from "@/app/controller";
import { createStore } from "@/app/store";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
function makeController() {
  return createAppController(createStore(initialState, reduceAppState));
}
function render(state) {
  document.querySelectorAll("#giso-extension-root").forEach((el) => {
    el.remove();
  });
  const { shadow } = ensureOverlayHost();
  renderApp(shadow, state, makeController());
  return shadow;
}
const group = {
  id: "sender:a@example.com",
  normalizedEmail: "a@example.com",
  displayNames: ["A"],
  primaryDisplayName: "A",
  visibleEntryCount: 3,
  sourceFingerprints: ["f1", "f2", "f3"],
  confidence: "high",
  status: "ready",
};
const analysis = {
  startedAt: 0,
  completedAt: 0,
  sourceRoute: { accountSlot: 0, view: "inbox", fingerprint: "view=inbox;slot=0" },
  rowCount: 3,
  resolvedCount: 3,
  unresolvedCount: 0,
  duplicateCount: 0,
  weakFingerprintCount: 0,
  groups: [group],
  unresolvedEntries: [],
};
beforeEach(() => {
  document.body.innerHTML = "";
});
describe("views: IDLE", () => {
  it("shows ready status, analyze + close buttons", () => {
    const shadow = render(initialState);
    expect(shadow.querySelector('[data-testid="giso-analyze"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-close"]')).not.toBeNull();
  });
});
describe("views: ANALYZING", () => {
  it("shows the spinner + analyzing text", () => {
    const shadow = render({ ...initialState, overlayVisible: true, workflow: "ANALYZING" });
    expect(shadow.querySelector(".giso-spinner")).not.toBeNull();
    expect(shadow.textContent).toContain("Posteingang wird analysiert");
  });
});
describe("views: RESULTS_READY", () => {
  it("lists groups with find-all button, filter, sort", () => {
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "RESULTS_READY",
      analysis,
    });
    expect(shadow.querySelector('[data-testid="giso-filter"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-sort"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-group"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-find-all"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-ignore"]')).not.toBeNull();
  });
  it("shows no-groups message when analysis has no groups", () => {
    const emptyAnalysis = { ...analysis, groups: [] };
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "RESULTS_READY",
      analysis: emptyAnalysis,
    });
    expect(shadow.textContent).toContain("keine Absender");
  });
  it("shows unresolved section when unresolved entries exist", () => {
    const withUnresolved = {
      ...analysis,
      unresolvedCount: 1,
      unresolvedEntries: [
        {
          fingerprint: "u1",
          rowIndex: 0,
          sender: {
            normalizedEmail: null,
            rawEmail: null,
            displayName: "Mystery",
            source: "none",
            confidence: "unresolved",
            diagnostics: ["GISO-SENDER-UNRESOLVED-001"],
          },
        },
      ],
    };
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "RESULTS_READY",
      analysis: withUnresolved,
    });
    expect(shadow.querySelector("details")).not.toBeNull();
  });
  it("filter input wires to setFilter on the controller", () => {
    const controller = makeController();
    const spy = vi.spyOn(controller, "setFilter");
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
    const { shadow } = ensureOverlayHost();
    renderApp(
      shadow,
      { ...initialState, overlayVisible: true, workflow: "RESULTS_READY", analysis },
      controller,
    );
    const input = shadow.querySelector('[data-testid="giso-filter"]');
    if (!input) throw new Error("filter input missing");
    input.value = "alpha";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(spy).toHaveBeenCalledWith("alpha");
  });
  it("sort select wires to setSort", () => {
    const controller = makeController();
    const spy = vi.spyOn(controller, "setSort");
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
    const { shadow } = ensureOverlayHost();
    renderApp(
      shadow,
      { ...initialState, overlayVisible: true, workflow: "RESULTS_READY", analysis },
      controller,
    );
    const select = shadow.querySelector('[data-testid="giso-sort"]');
    if (!select) throw new Error("sort select missing");
    select.value = "name";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(spy).toHaveBeenCalledWith("name");
  });
  it("find-all button wires to selectGroup", () => {
    const controller = makeAppControllerWithSpy("selectGroup");
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
    const { shadow } = ensureOverlayHost();
    renderApp(
      shadow,
      { ...initialState, overlayVisible: true, workflow: "RESULTS_READY", analysis },
      controller,
    );
    const findAll = shadow.querySelector('[data-testid="giso-find-all"]');
    if (!findAll) throw new Error("find-all button missing");
    findAll.click();
    expect(controller.selectGroup).toHaveBeenCalledWith("sender:a@example.com");
  });
});
describe("views: workflow states", () => {
  it("MANUAL_SELECT_ALL shows continue button + instruction", () => {
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "MANUAL_SELECT_ALL",
      activeGroupId: group.id,
      analysis,
      expectedQuery: 'in:inbox "from:a@example.com"',
    });
    expect(shadow.querySelector('[data-testid="giso-continue"]')).not.toBeNull();
    expect(shadow.textContent).toContain("Alle … auswählen");
  });
  it("WAITING_TARGET_SELECTION shows done + reopen buttons", () => {
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "WAITING_TARGET_SELECTION",
      activeGroupId: group.id,
      analysis,
    });
    expect(shadow.querySelector('[data-testid="giso-done"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-reopen"]')).not.toBeNull();
  });
  it("SET setting_SEARCH shows steps with search active", () => {
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "SETTING_SEARCH",
      activeGroupId: group.id,
      analysis,
      expectedQuery: 'in:inbox "from:a@example.com"',
    });
    const steps = shadow.querySelectorAll(".giso-step");
    expect(steps.length).toBe(5);
    const first = steps[0];
    if (!first) throw new Error("first step missing");
    expect(first.getAttribute("data-status")).toBe("active");
  });
});
describe("views: COMPLETED", () => {
  it("shows processed title and next/results buttons", () => {
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "COMPLETED",
      activeGroupId: group.id,
      analysis,
    });
    expect(shadow.textContent).toContain("Absender bearbeitet");
    expect(shadow.querySelector('[data-testid="giso-next"]')).not.toBeNull();
    expect(shadow.querySelector('[data-testid="giso-results"]')).not.toBeNull();
  });
});
describe("views: ERROR", () => {
  it("shows error block with code and back button", () => {
    const shadow = render({
      ...initialState,
      overlayVisible: true,
      workflow: "ERROR",
      error: {
        code: "GISO-SHELL-001",
        userMessageKey: "gmailNotReady",
        technicalMessage: "shell not detected",
        recoverable: true,
      },
    });
    expect(shadow.querySelector(".giso-error")).not.toBeNull();
    expect(shadow.textContent).toContain("GISO-SHELL-001");
    expect(shadow.querySelector('[data-testid="giso-back"]')).not.toBeNull();
  });
});
// Helper: build a controller whose methods are vi spies (for wiring tests).
function makeAppControllerWithSpy(method) {
  const store = createStore(initialState, reduceAppState);
  const real = createAppController(store);
  const spy = { ...real, [method]: vi.fn() };
  return spy;
}

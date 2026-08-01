import { describe, expect, it, vi } from "vitest";
import { createStore } from "@/app/store";
import { initialState } from "@/app/initial-state";
import { reduceAppState } from "@/app/state-machine";

describe("createStore", () => {
  it("dispatch updates state and notifies subscribers", () => {
    const store = createStore(initialState, reduceAppState);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: "TOGGLE_OVERLAY" });
    expect(store.getState().overlayVisible).toBe(true);
    expect(listener).toHaveBeenCalled();
  });
  it("a no-op transition (same state reference) does not notify", () => {
    const store = createStore(initialState, reduceAppState);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: "TOGGLE_OVERLAY" }); // flips to visible
    listener.mockClear();
    // ITI-043: SET_FILTER with an unchanged value returns the same state
    // reference, so the store treats it as a no-op and does NOT notify.
    store.dispatch({ type: "SET_FILTER", value: "" }); // same empty filter -> no-op
    expect(listener).not.toHaveBeenCalled();
  });
  it("isolates failing subscribers from others", () => {
    const store = createStore(initialState, reduceAppState);
    const good = vi.fn();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    store.subscribe(bad);
    store.subscribe(good);
    // Silence the expected console.error from the failing subscriber.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      /* swallow expected subscriber error */
    });
    store.dispatch({ type: "TOGGLE_OVERLAY" });
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
    spy.mockRestore();
  });
  it("unsubscribe stops further notifications", () => {
    const store = createStore(initialState, reduceAppState);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.dispatch({ type: "TOGGLE_OVERLAY" });
    expect(listener).not.toHaveBeenCalled();
  });
});

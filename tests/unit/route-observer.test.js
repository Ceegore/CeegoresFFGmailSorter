// Route observer tests (spec §13.6, §13.7, A.5): debounced route change
// detection, hashchange/popstate wiring, burst cooldown, clean dispose.
import { describe, expect, it, vi } from "vitest";
import { observeRoutes } from "@/gmail/route-observer";
describe("observeRoutes", () => {
  it("fires on hashchange (debounced)", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    loc.href = "https://mail.google.com/#search/from:x"; // route actually changes
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(cb).not.toHaveBeenCalled(); // still within debounce window
    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalledTimes(1);
    obs.dispose();
    vi.useRealTimers();
  });
  it("applies burst cooldown after >1000 mutations in 2s", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    // Fire 1001 hashchange events, each changing href, to trigger the burst
    // cooldown (>1000 => 500ms delay) AND satisfy the route-change condition.
    for (let i = 0; i < 1001; i++) {
      loc.href = `https://mail.google.com/#inbox/${String(i)}`;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    vi.advanceTimersByTime(200); // normal debounce (150) would have fired by now
    expect(cb).not.toHaveBeenCalled(); // but cooldown pushes it to 500ms
    vi.advanceTimersByTime(400); // total 600ms
    expect(cb).toHaveBeenCalledTimes(1);
    obs.dispose();
    vi.useRealTimers();
  });
  it("dispose removes listeners", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    obs.dispose();
    loc.href = "https://mail.google.com/#search/from:x";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    vi.advanceTimersByTime(300);
    expect(cb).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

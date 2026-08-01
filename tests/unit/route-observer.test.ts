// Route observer tests (spec §13.6, §13.7, A.5): route-change detection,
// hashchange/popstate wiring (IMMEDIATE per ITI-006), mutation burst cooldown,
// max-wait cap, and clean dispose.
import { describe, expect, it, vi } from "vitest";
import { observeRoutes } from "@/gmail/route-observer";

describe("observeRoutes", () => {
  it("fires on hashchange IMMEDIATELY (ITI-006, not debounced)", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    loc.href = "https://mail.google.com/#search/from:x"; // route actually changes
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    // ITI-006: hashchange is now processed immediately, not through the debounce.
    expect(cb).toHaveBeenCalledTimes(1);
    // No additional calls arrive from the debounce timers.
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
    obs.dispose();
    vi.useRealTimers();
  });

  it("does not fire on hashchange when href is unchanged", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
    obs.dispose();
    vi.useRealTimers();
  });

  it("fires on popstate IMMEDIATELY (ITI-006, not debounced)", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    loc.href = "https://mail.google.com/#search/from:y";
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
    obs.dispose();
    vi.useRealTimers();
  });

  it("debounces mutation-driven route changes (150ms)", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    loc.href = "https://mail.google.com/#search/from:z";
    // A mutation that coincides with a changed href.
    document.documentElement.setAttribute("data-giso-probe", "1");
    // The MutationObserver microtask flushes; schedule() runs and arms a timer.
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled(); // still within the 150ms debounce window
    vi.advanceTimersByTime(160);
    expect(cb).toHaveBeenCalledTimes(1);
    obs.dispose();
    vi.useRealTimers();
  });

  it("applies burst cooldown after >1000 mutations in 2s", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    // Drive burstCount above 1000 by flushing each mutation separately (the
    // MutationObserver batches synchronous mutations into one callback, so each
    // iteration must await a microtask to increment burstCount independently).
    for (let i = 0; i < 1001; i++) {
      loc.href = `https://mail.google.com/#inbox/${String(i)}`;
      document.documentElement.setAttribute("data-giso-probe", String(i));
      await Promise.resolve();
    }
    vi.advanceTimersByTime(200); // normal debounce (150) would have fired by now
    expect(cb).not.toHaveBeenCalled(); // but cooldown (>1000) pushes the timer to 500ms
    vi.advanceTimersByTime(400); // total 600ms
    expect(cb).toHaveBeenCalledTimes(1);
    obs.dispose();
    vi.useRealTimers();
  });

  it("max-wait cap fires after 1000ms even on continuous mutations", async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const loc = { href: "https://mail.google.com/#inbox" };
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: loc });
    const obs = observeRoutes(cb);
    // First mutation: establishes firstMutationAt and arms the debounce timer.
    loc.href = "https://mail.google.com/#search/first";
    document.documentElement.setAttribute("data-giso-probe", "first");
    await Promise.resolve();
    await Promise.resolve();
    // Keep mutating every 150ms (each resets the debounce timer) for 1000ms+.
    // Without ITI-006's max-wait cap this would starve the callback forever.
    for (let t = 0; t < 7; t++) {
      vi.advanceTimersByTime(150);
      loc.href = `https://mail.google.com/#search/burst/${String(t)}`;
      document.documentElement.setAttribute("data-giso-probe", `burst-${String(t)}`);
      // Flush the MutationObserver microtask batch so schedule() runs.
      await Promise.resolve();
      await Promise.resolve();
    }
    // >1000ms elapsed since firstMutationAt => the cap fires on the next
    // mutation after the cap is reached.
    vi.advanceTimersByTime(150);
    expect(cb).toHaveBeenCalled();
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

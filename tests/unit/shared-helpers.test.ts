// Small shared-helper tests: dom.ts (isInteractable, isUnderOverlay), abort.ts,
// time.ts (delay, waitForFingerprint), messages.ts (isContentResponse), result.ts.
import { describe, expect, it, vi } from "vitest";
import { isInteractable, isUnderOverlay } from "@/shared/dom";
import { assertNotAborted, isAbortError } from "@/shared/abort";
import { delay, waitForFingerprint } from "@/shared/time";
import { isContentResponse } from "@/shared/messages";
import { ok, err, mapResult } from "@/shared/result";

describe("isInteractable", () => {
  it("returns true for a connected visible element", () => {
    const el = document.createElement("button");
    document.body.append(el);
    expect(isInteractable(el)).toBe(true);
  });
  it("returns false for a disconnected element", () => {
    const el = document.createElement("button");
    expect(isInteractable(el)).toBe(false);
  });
  it("returns false for hidden attribute", () => {
    const el = document.createElement("button");
    el.hidden = true;
    document.body.append(el);
    expect(isInteractable(el)).toBe(false);
  });
  it("returns false for aria-hidden=true", () => {
    const el = document.createElement("button");
    el.setAttribute("aria-hidden", "true");
    document.body.append(el);
    expect(isInteractable(el)).toBe(false);
  });
  it("returns false for disabled", () => {
    const el = document.createElement("button");
    el.disabled = true;
    document.body.append(el);
    expect(isInteractable(el)).toBe(false);
  });
  it("returns false for a non-HTMLElement", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    document.body.append(svg);
    expect(isInteractable(svg)).toBe(false);
  });
});

describe("isUnderOverlay", () => {
  it("returns false when no overlay host exists", () => {
    document.querySelectorAll("#giso-extension-root").forEach((el) => {
      el.remove();
    });
    const el = document.createElement("div");
    expect(isUnderOverlay(el)).toBe(false);
  });
});

describe("abort helpers", () => {
  it("assertNotAborted throws on an aborted signal", () => {
    const ac = new AbortController();
    ac.abort();
    expect(() => {
      assertNotAborted(ac.signal);
    }).toThrow();
  });
  it("isAbortError recognizes AbortError", () => {
    const e = new DOMException("x", "AbortError");
    expect(isAbortError(e)).toBe(true);
    expect(isAbortError(new Error("x"))).toBe(false);
  });
});

describe("time helpers", () => {
  it("delay resolves after ms", async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const p = delay(100, ac.signal);
    vi.advanceTimersByTime(120);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
  it("delay rejects on abort", async () => {
    const ac = new AbortController();
    const p = delay(1000, ac.signal);
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
  it("delay rejects immediately if already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(delay(10, ac.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("waitForFingerprint resolves when read/accept are satisfied and stable", async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const v = "ready";
    const p = waitForFingerprint<string>({
      read: () => v,
      accept: (x) => x === "ready",
      timeoutMs: 1000,
      stabilityMs: 100,
      signal: ac.signal,
    });
    await vi.advanceTimersByTimeAsync(160);
    await expect(p).resolves.toBe("ready");
    vi.useRealTimers();
  });
  it("waitForFingerprint rejects on timeout", async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const p = waitForFingerprint<string>({
      read: () => "loading",
      accept: () => false,
      timeoutMs: 300,
      stabilityMs: 50,
      signal: ac.signal,
    });
    vi.advanceTimersByTime(400);
    await expect(p).rejects.toThrow(/timed out/u);
    vi.useRealTimers();
  });
});

describe("isContentResponse", () => {
  it("accepts a valid response", () => {
    expect(isContentResponse({ ok: true })).toBe(true);
    expect(isContentResponse({ ok: false, error: "x" })).toBe(true);
    expect(isContentResponse({ ok: true, overlayVisible: false })).toBe(true);
  });
  it("rejects invalid shapes", () => {
    expect(isContentResponse(null)).toBe(false);
    expect(isContentResponse({})).toBe(false);
    expect(isContentResponse({ ok: "yes" })).toBe(false);
    expect(isContentResponse({ ok: 1 })).toBe(false);
    expect(isContentResponse({ ok: true, overlayVisible: "x" })).toBe(false);
    expect(isContentResponse({ ok: true, error: 5 })).toBe(false);
  });
});

describe("result helpers", () => {
  it("ok/err and mapResult", () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });
    expect(mapResult(err("e"), (n) => n * 3)).toEqual({ ok: false, error: "e" });
  });
});

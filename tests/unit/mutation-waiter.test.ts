// Mutation waiter tests (spec A.6): waits for a stable primitive fingerprint,
// respects timeout, aborts cleanly.
import { describe, expect, it, vi } from "vitest";
import { waitForMutationState } from "@/gmail/mutation-waiter";

describe("waitForMutationState", () => {
  it("resolves immediately when fingerprint is already acceptable and stable", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const value = "ready";
    const read: () => string = () => value;
    const p = waitForMutationState({
      root,
      readFingerprint: read,
      accept: (v: string) => v === "ready",
      timeoutMs: 1000,
      stabilityMs: 50,
      signal: new AbortController().signal,
    });
    await vi.advanceTimersByTimeAsync(60);
    await expect(p).resolves.toBe("ready");
    vi.useRealTimers();
  });

  it("rejects on timeout when never acceptable", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const fp = (): string => "loading";
    const p = waitForMutationState({
      root,
      readFingerprint: fp,
      accept: (v: string) => v === "ready",
      timeoutMs: 500,
      stabilityMs: 50,
      signal: new AbortController().signal,
    });
    vi.advanceTimersByTime(600);
    await expect(p).rejects.toThrow(/timed out/u);
    vi.useRealTimers();
  });

  it("rejects with AbortError when signal aborts", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const ac = new AbortController();
    const fp = (): string => "loading";
    const p = waitForMutationState({
      root,
      readFingerprint: fp,
      accept: () => false,
      timeoutMs: 5000,
      stabilityMs: 50,
      signal: ac.signal,
    });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    vi.useRealTimers();
  });

  it("rejects synchronously when signal already aborted", async () => {
    const root = document.createElement("div");
    const ac = new AbortController();
    ac.abort();
    await expect(
      waitForMutationState({
        root,
        readFingerprint: () => "x",
        accept: () => true,
        timeoutMs: 100,
        stabilityMs: 10,
        signal: ac.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

import { assertNotAborted } from "./abort";

export async function delay(ms: number, signal: AbortSignal): Promise<void> {
  assertNotAborted(signal);
  await new Promise<void>((resolve, reject) => {
    // BUG-041: the abort listener must be removed on the normal (timeout) path
    // too, otherwise every completed delay leaks a listener on the signal for
    // the lifetime of the controller owning it. The `settled` guard makes
    // cleanup idempotent against a late abort racing with the timeout firing.
    let settled = false;
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(new DOMException("Operation aborted", "AbortError"));
    };
    const cleanup = () => {
      settled = true;
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForFingerprint<T extends string | number | boolean>(options: {
  readonly read: () => T | null;
  readonly accept: (value: T) => boolean;
  readonly timeoutMs: number;
  readonly stabilityMs: number;
  readonly signal: AbortSignal;
}): Promise<T> {
  const { read, accept, timeoutMs, stabilityMs, signal } = options;
  const started = performance.now();
  let candidate: T | null = null;
  let stableSince = 0;
  while (performance.now() - started < timeoutMs) {
    assertNotAborted(signal);
    const current = read();
    if (current === null || !accept(current)) {
      candidate = null;
      stableSince = 0;
    } else if (candidate === current) {
      if (performance.now() - stableSince >= stabilityMs) return current;
    } else {
      candidate = current;
      stableSince = performance.now();
    }
    await delay(50, signal);
  }
  throw new Error(`waitForFingerprint timed out after ${String(timeoutMs)} ms`);
}

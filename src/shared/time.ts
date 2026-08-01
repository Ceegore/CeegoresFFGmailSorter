import { assertNotAborted } from "./abort";

export async function delay(ms: number, signal: AbortSignal): Promise<void> {
  assertNotAborted(signal);
  await new Promise<void>((resolve, reject) => {
    // BUG-041: the abort listener must be removed on the normal (timeout) path
    // too, otherwise every completed delay leaks a listener on the signal for
    // the lifetime of the controller owning it. The `settled` guard makes
    // cleanup idempotent against a late abort racing with the timeout firing.
    let settled = false;
    let timer = -1;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      if (timer !== -1) window.clearTimeout(timer);
      reject(new DOMException("Operation aborted", "AbortError"));
    };
    const cleanup = () => {
      settled = true;
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    // CUR-033: recheck after registering the listener — an abort could fire
    // between the top-of-function assertNotAborted and addEventListener. Do
    // this BEFORE arming the timeout so no timer is leaked.
    if (signal.aborted) {
      cleanup();
      throw new DOMException("Operation aborted", "AbortError");
    }
    timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
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

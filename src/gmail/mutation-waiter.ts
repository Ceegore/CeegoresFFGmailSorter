// Mutation-based state waiter (spec appendix A.6). Compares primitive semantic
// fingerprints — comparing HTMLElement identity is NOT valid stability
// evidence (attributes/text may change on the same node).
import { assertNotAborted } from "@/shared/abort";

export async function waitForMutationState<T extends string | number | boolean>(options: {
  readonly root: Node;
  readonly readFingerprint: () => T | null;
  readonly accept: (fingerprint: T) => boolean;
  readonly timeoutMs: number;
  readonly stabilityMs: number;
  readonly signal: AbortSignal;
}): Promise<T> {
  const { root, readFingerprint, accept, timeoutMs, stabilityMs, signal } = options;
  assertNotAborted(signal);

  return new Promise<T>((resolve, reject) => {
    let last: T | null = null;
    let stableSince = 0;
    let pollTimer: number | null = null;
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      signal.removeEventListener("abort", onAbort);
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      window.clearTimeout(timeoutTimer);
      callback();
    };
    const onAbort = (): void => {
      finish(() => {
        reject(new DOMException("Operation aborted", "AbortError"));
      });
    };
    const check = (): void => {
      if (settled) return;
      const current = readFingerprint();
      const now = performance.now();
      if (
        current !== null &&
        current === last &&
        accept(current) &&
        now - stableSince >= stabilityMs
      ) {
        finish(() => {
          resolve(current);
        });
        return;
      }
      if (current !== last) {
        last = current;
        stableSince = now;
      }
      // ITI-051: clear any previously scheduled poll timer before scheduling a
      // new one. Without this, each check() (and each MutationObserver
      // callback) stacked another pending timer, causing a timer storm.
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(check, Math.min(50, Math.max(10, stabilityMs)));
    };

    const observer = new MutationObserver(check);
    const timeoutTimer = window.setTimeout(() => {
      finish(() => {
        reject(new Error(`Mutation wait timed out after ${String(timeoutMs)} ms`));
      });
    }, timeoutMs);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}

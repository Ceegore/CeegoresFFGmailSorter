export interface RouteObserver {
  readonly dispose: () => void;
}

const MAX_WAIT_MS = 1000;

export function observeRoutes(onRouteChange: () => void): RouteObserver {
  let last = location.href;
  let timer: number | null = null;
  let burstStarted = performance.now();
  let burstCount = 0;
  let firstMutationAt = 0;

  const schedule = (): void => {
    burstCount += 1;
    const now = performance.now();
    if (now - burstStarted > 2_000) {
      burstStarted = now;
      burstCount = 1;
      firstMutationAt = now;
    }
    if (firstMutationAt === 0) firstMutationAt = now;
    const sinceFirst = now - firstMutationAt;
    const delayMs = burstCount > 1_000 ? 500 : 150;
    // If we've waited too long, fire immediately
    if (sinceFirst >= MAX_WAIT_MS) {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      if (location.href !== last) {
        last = location.href;
        onRouteChange();
      }
      // H-2: reset the burst bookkeeping alongside firstMutationAt so the next
      // mutation starts a fresh burst instead of carrying stale counters.
      burstStarted = now;
      burstCount = 1;
      firstMutationAt = 0;
      return;
    }
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      firstMutationAt = 0;
      if (location.href !== last) {
        last = location.href;
        onRouteChange();
      }
    }, delayMs);
  };

  const onHashChange = (): void => {
    if (location.href !== last) {
      last = location.href;
      onRouteChange();
    }
  };

  // CUR-031: instrument History API so pushState/replaceState are detected
  // even without a DOM mutation.
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args);
    onHashChange();
  };
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    originalReplaceState(...args);
    onHashChange();
  };

  const observer = new MutationObserver(schedule);
  // CUR-032: attributes:true watches every attribute change in the entire
  // document (class toggles, style updates, aria changes) — the dominant
  // mutation source and irrelevant to route detection. Keep only childList.
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("popstate", onHashChange);
  return {
    dispose: () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    },
  };
}

export interface RouteObserver {
  readonly dispose: () => void;
}

export function observeRoutes(onRouteChange: () => void): RouteObserver {
  let last = location.href;
  let timer: number | null = null;
  let burstStarted = performance.now();
  let burstCount = 0;

  const schedule = (): void => {
    burstCount += 1;
    const now = performance.now();
    if (now - burstStarted > 2_000) {
      burstStarted = now;
      burstCount = 1;
    }
    const delayMs = burstCount > 1_000 ? 500 : 150;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      if (location.href !== last) {
        last = location.href;
        onRouteChange();
      }
    }, delayMs);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("popstate", schedule);
  return {
    dispose: () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("popstate", schedule);
    },
  };
}

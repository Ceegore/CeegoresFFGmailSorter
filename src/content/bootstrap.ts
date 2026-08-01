import { createAppController } from "@/app/controller";
import { initialState } from "@/app/initial-state";
import { reduceAppState } from "@/app/state-machine";
import { createStore } from "@/app/store";
import { observeRoutes } from "@/gmail/route-observer";
import type { BackgroundToContentMessage, ContentResponse } from "@/shared/messages";
import { ensureOverlayHost } from "@/ui/overlay-host";
import { renderApp } from "@/ui/render";

const BOOTSTRAP_KEY = Symbol.for("giso.bootstrap.state");
type BootState = "initializing" | "ready";

export function bootstrap(): void {
  const globalState = globalThis as typeof globalThis & { [BOOTSTRAP_KEY]?: BootState };
  if (globalState[BOOTSTRAP_KEY]) return;
  globalState[BOOTSTRAP_KEY] = "initializing";

  try {
    const { host, shadow } = ensureOverlayHost();
    const store = createStore(initialState, reduceAppState, (s) => {
      // ITI-041: the snapshot must react to ANY group status change, not just the
      // active group's. Ignoring a non-active group mutates that group's status
      // without touching the active one, so a snapshot that only watched the
      // active group would report accepted=false (no real transition). Including
      // a digest of every group's status makes ignore/restore of any group an
      // accepted transition, so the controller's effect layer runs.
      const groupsDigest = s.analysis?.groups.map((g) => `${g.id}:${g.status}`).join(",") ?? "";
      return [
        s.workflow,
        s.activeGroupId,
        s.error?.code ?? "",
        s.analysis !== null,
        s.overlayVisible,
        s.expectedQuery ?? "",
        s.filter,
        s.sort,
        s.activeGroupId
          ? (s.analysis?.groups.find((g) => g.id === s.activeGroupId)?.status ?? "")
          : "",
        groupsDigest,
      ];
    });
    const controller = createAppController(store);
    const unsubscribe = store.subscribe((state) => {
      renderApp(shadow, state, controller);
    });
    // Expose a minimal test bridge so Playwright can open the overlay without
    // the browser-action toggle. This mirrors the background's SHOW_OVERLAY
    // message and is harmless in production (the toolbar action uses the same
    // code path). It is never used for data extraction.
    const testBridge = globalThis as typeof globalThis & {
      __gisoController?: typeof controller;
      __gisoShowOverlay?: () => void;
    };
    testBridge.__gisoController = controller;
    testBridge.__gisoShowOverlay = () => {
      // Result is intentionally discarded; the store subscription re-renders.
      void controller.handleBackgroundMessage("SHOW_OVERLAY");
    };
    renderApp(shadow, store.getState(), controller);

    // ITI-050: the narrow-viewport warning is computed during render from
    // window.innerWidth, so a resize that crosses the 720px threshold needs to
    // re-render the current state. Debounce so a drag doesn't thrash the DOM.
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        renderApp(shadow, store.getState(), controller);
      }, 200);
    };
    window.addEventListener("resize", onResize);

    const routeObserver = observeRoutes(() => {
      // CUR-036: a third party (Gmail's own scripts, a conflicting extension,
      // or a SPA teardown) can remove the overlay host from the document
      // without our knowledge. The pageshow handler covers bfcache restores,
      // but an in-life removal while the page stays open would leave the
      // extension silently absent until reload. On every route change (already
      // a re-render trigger), first verify the host is still attached; if it
      // was removed, re-append it and re-render so the overlay self-heals.
      if (!host.isConnected) {
        document.documentElement.append(host);
        renderApp(shadow, store.getState(), controller);
      }
      // BUG-035: a route change invalidates the session atomically. The
      // controller's own search is handled inside safeRun (it sets an expected
      // transition flag); only UNEXPECTED changes reach here and reset to IDLE.
      controller.invalidateOnRouteChange();
    });

    // Firefox supports listeners that return a Promise resolving to the
    // response. The bundled WebExtension types allow a Promise return, so we
    // always return a Promise<ContentResponse> and narrow the message inside.
    // In a non-extension context (mock E2E) `browser.runtime` is absent; skip
    // listener registration there — the test bridge drives the overlay instead.
    let removeRuntimeListener: (() => void) | null = null;
    const runtime = typeof browser !== "undefined" ? browser.runtime : undefined;
    if (runtime?.onMessage) {
      type RuntimeListener = Parameters<typeof runtime.onMessage.addListener>[0];
      const listener: RuntimeListener = (message: unknown): Promise<ContentResponse> => {
        const typed = message as Partial<BackgroundToContentMessage>;
        if (typed.type !== "TOGGLE_OVERLAY" && typed.type !== "SHOW_OVERLAY") {
          return Promise.resolve<ContentResponse>({ ok: false, error: "Unsupported message" });
        }
        const result = controller.handleBackgroundMessage(typed.type);
        return Promise.resolve(result);
      };
      runtime.onMessage.addListener(listener);
      removeRuntimeListener = () => {
        runtime.onMessage.removeListener(listener);
      };
    }

    const onPageHide = (event: PageTransitionEvent): void => {
      if (!event.persisted) dispose();
    };
    const onPageShow = (): void => {
      if (!host.isConnected) document.documentElement.append(host);
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    function dispose(): void {
      controller.dispose();
      routeObserver.dispose();
      unsubscribe();
      removeRuntimeListener?.();
      window.removeEventListener("resize", onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      // C-1: tear down the overlay's positioning listeners (notably the window
      // resize listener added by wirePositioning) before the host is removed,
      // otherwise they leak for the page lifetime.
      const overlay = host.shadowRoot?.querySelector<HTMLElement>(".giso-overlay");
      (
        overlay as unknown as { __positioningCleanup?: () => void } | null
      )?.__positioningCleanup?.();
      host.remove();
      const testBridge = globalThis as typeof globalThis & {
        __gisoController?: unknown;
        __gisoShowOverlay?: unknown;
      };
      delete testBridge.__gisoController;
      delete testBridge.__gisoShowOverlay;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- symbol-keyed internal bootstrap guard
      delete globalState[BOOTSTRAP_KEY];
    }
    globalState[BOOTSTRAP_KEY] = "ready";
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- symbol-keyed internal bootstrap guard
    delete globalState[BOOTSTRAP_KEY];
    throw error;
  }
}

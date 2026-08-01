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
    const store = createStore(initialState, reduceAppState, (s) => [
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
    ]);
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

    const routeObserver = observeRoutes(() => {
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
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
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

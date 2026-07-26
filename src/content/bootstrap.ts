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
    const store = createStore(initialState, reduceAppState);
    const controller = createAppController(store);
    const unsubscribe = store.subscribe((state) => {
      renderApp(shadow, state, controller);
    });
    renderApp(shadow, store.getState(), controller);

    const routeObserver = observeRoutes(() => {
      controller.cancel("route-changed");
      controller.resetSession();
    });

    // Firefox supports listeners that return a Promise resolving to the
    // response. The bundled WebExtension types allow a Promise return, so we
    // always return a Promise<ContentResponse> and narrow the message inside.
    type RuntimeListener = Parameters<typeof browser.runtime.onMessage.addListener>[0];
    const listener: RuntimeListener = (message: unknown): Promise<ContentResponse> => {
      const typed = message as Partial<BackgroundToContentMessage>;
      if (typed.type !== "TOGGLE_OVERLAY" && typed.type !== "SHOW_OVERLAY") {
        return Promise.resolve<ContentResponse>({ ok: false, error: "Unsupported message" });
      }
      const result = controller.handleBackgroundMessage(typed.type);
      return Promise.resolve(result);
    };
    browser.runtime.onMessage.addListener(listener);

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
      browser.runtime.onMessage.removeListener(listener);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      host.remove();
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

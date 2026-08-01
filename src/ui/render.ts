// Render dispatcher. Owns the overlay shell, the brand-credit guarantee
// (exactly one per render, spec §56.3) and view selection. View bodies live in
// src/ui/components/* and are pure(state, controller) -> nodes functions that
// insert runtime values via textContent only.
import type { AppController } from "@/app/controller";
import { de } from "@/i18n/de";
import type { AppState } from "@/shared/types";
import { renderBrandCredit } from "@/ui/brand-credit";
import { renderView } from "@/ui/views";
import {
  applyPosition,
  loadPosition,
  persistPosition,
  wirePositioning,
  DEFAULT_POSITION,
  type Position,
} from "@/ui/overlay-position";
import STYLES from "@/ui/styles.css?raw";

const STYLE_ID = "giso-styles";
const POSITIONED_FLAG = "data-giso-position-wired";

function injectStyles(shadow: ShadowRoot): void {
  if (shadow.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  shadow.append(style);
}

export function renderApp(shadow: ShadowRoot, state: AppState, controller: AppController): void {
  injectStyles(shadow);

  const existing = shadow.querySelector<HTMLElement>(".giso-overlay");
  const overlay: HTMLElement = existing ?? buildShell();
  if (!existing) {
    shadow.append(overlay);
    wireHandleOnce(overlay);
  }

  const body = overlay.querySelector<HTMLElement>("[data-testid='giso-body']");
  if (!body) return;

  // CUR-022: set the overlay's visibility BEFORE any focus management.
  overlay.style.display = state.overlayVisible ? "" : "none";

  // BUG-004 / ITI-004: preserve focus across re-renders. The filter input (and
  // other focusable controls) loses focus when body.replaceChildren() rebuilds
  // the DOM. Snapshot the focused element's data-testid + selection before the
  // rebuild, then restore it to the equivalent element afterward. Because the
  // overlay lives in a Shadow DOM, document.activeElement returns the shadow
  // host — use shadow.activeElement to capture the real focused element.
  const activeEl = shadow.activeElement as HTMLElement | null;
  const activeTestid = activeEl?.dataset["testid"];
  const selectionStart = activeEl instanceof HTMLInputElement ? activeEl.selectionStart : null;
  const selectionEnd = activeEl instanceof HTMLInputElement ? activeEl.selectionEnd : null;

  // View-specific content. The narrow-viewport warning is preserved across renders.
  const warning = body.querySelector("[data-testid='giso-narrow-warning']");
  body.replaceChildren();
  if (window.innerWidth < 720 && warning) body.append(warning);
  for (const node of renderView(state, controller)) body.append(node);
  if (window.innerWidth < 720 && !body.querySelector("[data-testid='giso-narrow-warning']")) {
    body.prepend(buildNarrowWarning());
  }

  // Restore focus to the previously focused element by data-testid.
  // CUR-023: track whether focus was actually restored. If the previous
  // element's data-testid no longer exists in the new view, fall through to the
  // heading/button fallback below instead of leaving the overlay unfocused.
  let focusRestored = false;
  if (state.overlayVisible && activeTestid) {
    const el = body.querySelector<HTMLElement>(`[data-testid="${activeTestid}"]`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement && selectionStart !== null && selectionEnd !== null) {
        el.setSelectionRange(selectionStart, selectionEnd);
      }
      focusRestored = true;
    }
  }

  // CUR-022: only run fallback focus management when overlay is visible.
  // ITI-047/CUR-023: if no element had focus before (or focus could not be
  // restored), move focus to the view's heading or first interactive element.
  if (state.overlayVisible && !focusRestored) {
    const heading = body.querySelector<HTMLElement>("h1, h2, h3, [role='heading']");
    if (heading) {
      heading.focus();
    } else {
      const firstButton = body.querySelector<HTMLElement>("button, [role='button']");
      if (firstButton) firstButton.focus();
    }
  }

  // Footer carries exactly one brand credit, reattached each render.
  const footer = overlay.querySelector<HTMLElement>("[data-testid='giso-footer']");
  footer?.replaceChildren(renderBrandCredit());
}

function buildShell(): HTMLElement {
  const overlay = document.createElement("section");
  overlay.className = "giso-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", de.addonName);

  const header = document.createElement("header");
  header.className = "giso-overlay__header";
  const title = document.createElement("h1");
  title.className = "giso-overlay__title";
  // ITI-047: make the title focusable so it can be the focus target on view
  // transitions where no specific control previously held focus.
  title.tabIndex = -1;
  title.textContent = de.addonName;
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "giso-overlay__handle";
  handle.dataset["testid"] = "giso-move-handle";
  handle.setAttribute("aria-label", de.moveOverlay);
  handle.textContent = "⠿";
  header.append(title, handle);

  const body = document.createElement("div");
  body.className = "giso-overlay__body";
  body.dataset["testid"] = "giso-body";

  const footer = document.createElement("div");
  footer.className = "giso-overlay__footer";
  footer.dataset["testid"] = "giso-footer";

  overlay.append(header, body, footer);
  return overlay;
}

function buildNarrowWarning(): HTMLElement {
  const warning = document.createElement("p");
  warning.className = "giso-narrow-warning";
  warning.dataset["testid"] = "giso-narrow-warning";
  warning.textContent = de.narrowViewportWarning;
  return warning;
}

/**
 * Wire overlay drag/keyboard once per shell. Idempotent via a marker so
 * repeated renders do not stack listeners. Position is loaded and applied on
 * first wire; subsequent drags persist on pointerup (spec §56.5).
 *
 * ITI-020 / ITI-021: the persisted position is loaded BEFORE the handle is
 * wired so (a) the internal `current` state and the visually applied position
 * never diverge, and (b) the user cannot drag before the load resolves. A
 * synchronous default-position placeholder is applied first to avoid a flash
 * of an unpositioned overlay.
 *
 * C-1: the teardown returned by wirePositioning (which owns the resize
 * listener) is stored on the overlay so bootstrap's dispose path can invoke it
 * — otherwise the listener leaks for the page lifetime.
 * C-3: wirePositioning runs asynchronously, so the synchronous POSITIONED_FLAG
 * guard cannot stop a late .then/.catch from wiring an overlay that has since
 * been removed. An isConnected check at the top of each callback prevents a
 * double-wire / wire-after-dispose.
 */
type OverlayWithCleanup = HTMLElement & { __positioningCleanup?: () => void };

function wireHandleOnce(overlay: HTMLElement): void {
  if (overlay.getAttribute(POSITIONED_FLAG) === "1") return;
  overlay.setAttribute(POSITIONED_FLAG, "1");
  applyPosition(overlay, DEFAULT_POSITION); // visual placeholder until loaded
  void loadPosition()
    .then((pos) => {
      if (!overlay.isConnected) return;
      applyPosition(overlay, pos);
      const handle = overlay.querySelector<HTMLElement>("[data-testid='giso-move-handle']");
      if (handle) {
        overlayCleanup(overlay)?.();
        (overlay as OverlayWithCleanup).__positioningCleanup = wirePositioning(
          overlay,
          handle,
          persistCallback,
          pos,
        );
      }
    })
    .catch(() => {
      if (!overlay.isConnected) return;
      applyPosition(overlay, DEFAULT_POSITION);
      const handle = overlay.querySelector<HTMLElement>("[data-testid='giso-move-handle']");
      if (handle) {
        overlayCleanup(overlay)?.();
        (overlay as OverlayWithCleanup).__positioningCleanup = wirePositioning(
          overlay,
          handle,
          persistCallback,
        );
      }
    });
}

function overlayCleanup(overlay: HTMLElement): (() => void) | undefined {
  return (overlay as OverlayWithCleanup).__positioningCleanup;
}

/**
 * CUR-030: persistence is debounced inside wirePositioning (last-write-wins),
 * but the persistPosition promise itself can reject if storage.local is
 * unavailable or the quota is exceeded. Swallow the rejection here so it never
 * becomes an unhandled rejection — the overlay keeps its in-memory position
 * regardless; only the saved value is lost, which is the correct V1 behavior.
 */
function persistCallback(pos: Position): void {
  void persistPosition(pos).catch(() => {
    /* storage may be unavailable; position not saved */
  });
}

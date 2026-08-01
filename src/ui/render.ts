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
  if (activeTestid) {
    const el = body.querySelector<HTMLElement>(`[data-testid="${activeTestid}"]`);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement && selectionStart !== null && selectionEnd !== null) {
        el.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }

  // Footer carries exactly one brand credit, reattached each render.
  const footer = overlay.querySelector<HTMLElement>("[data-testid='giso-footer']");
  footer?.replaceChildren(renderBrandCredit());

  overlay.style.display = state.overlayVisible ? "" : "none";
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
 */
function wireHandleOnce(overlay: HTMLElement): void {
  if (overlay.getAttribute(POSITIONED_FLAG) === "1") return;
  overlay.setAttribute(POSITIONED_FLAG, "1");
  applyPosition(overlay, DEFAULT_POSITION); // visual placeholder until loaded
  void loadPosition()
    .then((pos) => {
      applyPosition(overlay, pos);
      const handle = overlay.querySelector<HTMLElement>("[data-testid='giso-move-handle']");
      if (handle) {
        wirePositioning(
          overlay,
          handle,
          (p) => {
            void persistPosition(p);
          },
          pos,
        );
      }
    })
    .catch(() => {
      applyPosition(overlay, DEFAULT_POSITION);
      const handle = overlay.querySelector<HTMLElement>("[data-testid='giso-move-handle']");
      if (handle) {
        wirePositioning(overlay, handle, (p) => {
          void persistPosition(p);
        });
      }
    });
}

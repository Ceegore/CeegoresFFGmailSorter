// Render dispatcher. Owns the overlay shell, the brand-credit guarantee
// (exactly one per render, spec §56.3) and view selection. View bodies live in
// src/ui/components/* and are pure(state, controller) -> nodes functions that
// insert runtime values via textContent only.
import type { AppController } from "@/app/controller";
import { de } from "@/i18n/de";
import type { AppState } from "@/shared/types";
import { renderBrandCredit } from "@/ui/brand-credit";
import { renderView } from "@/ui/views";
import STYLES from "@/ui/styles.css?raw";

const STYLE_ID = "giso-styles";

function injectStyles(shadow: ShadowRoot): void {
  if (shadow.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  shadow.append(style);
}

export function renderApp(shadow: ShadowRoot, state: AppState, controller: AppController): void {
  injectStyles(shadow);

  let overlay = shadow.querySelector<HTMLElement>(".giso-overlay");
  if (!overlay) {
    overlay = buildShell();
    shadow.append(overlay);
  }

  const body = overlay.querySelector<HTMLElement>("[data-testid='giso-body']");
  if (!body) return;

  // View-specific content. The narrow-viewport warning is preserved across renders.
  const warning = body.querySelector("[data-testid='giso-narrow-warning']");
  body.replaceChildren();
  if (window.innerWidth < 720 && warning) body.append(warning);
  for (const node of renderView(state, controller)) body.append(node);
  if (window.innerWidth < 720 && !body.querySelector("[data-testid='giso-narrow-warning']")) {
    body.prepend(buildNarrowWarning());
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

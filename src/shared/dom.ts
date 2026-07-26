/**
 * Shared, Gmail-agnostic DOM helpers. These do not contain any Gmail selector
 * knowledge — only generic interactability/visibility checks reused across the
 * adapter and controllers.
 */
export function isInteractable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true")
    return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  // Opacity may be the empty string (unset); treat that as fully opaque.
  const opacity = style.opacity.trim();
  if (opacity !== "" && Number(opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

/** True when `rect` overlaps the overlay host's bounding box, if present. */
export function isUnderOverlay(element: Element): boolean {
  const host = document.getElementById("giso-extension-root");
  if (!host) return false;
  const a = element.getBoundingClientRect();
  const b = host.getBoundingClientRect();
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

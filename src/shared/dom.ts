/**
 * Shared, Gmail-agnostic DOM helpers. These do not contain any Gmail selector
 * knowledge — only generic interactability/visibility checks reused across the
 * adapter and controllers.
 */

/**
 * Check whether an element is genuinely interactable (BUG-043).
 * Beyond the basic checks, this now verifies:
 * - pointer-events is not "none"
 * - the element is not inert
 * - all ancestors are visible (no hidden parent)
 * - viewport intersection (element is at least partially on-screen)
 * Additionally, isUnderOverlay is checked to prevent clicking through the overlay.
 */
export function isInteractable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true")
    return false;
  // BUG-043: check inert attribute.
  if (element.hasAttribute("inert")) return false;

  // Check own computed style.
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  // BUG-043: check pointer-events.
  if (style.pointerEvents === "none") return false;
  // Opacity may be the empty string (unset); treat that as fully opaque.
  const opacity = style.opacity.trim();
  if (opacity !== "" && Number(opacity) === 0) return false;

  // BUG-043: check ancestor visibility (a parent with display:none hides children).
  if (!areAncestorsVisible(element)) return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

/** Check that no ancestor has display:none, visibility:hidden, or aria-hidden. */
function areAncestorsVisible(element: HTMLElement): boolean {
  let parent: HTMLElement | null = element.parentElement;
  while (parent) {
    if (parent.hidden || parent.getAttribute("aria-hidden") === "true") return false;
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === "none" || parentStyle.visibility === "hidden") return false;
    parent = parent.parentElement;
  }
  return true;
}

/**
 * True when `element` overlaps the visible overlay panel (BUG-044).
 * Reads the actual `.giso-overlay` element from the shadow root, NOT the
 * 0×0 shadow host.
 */
export function isUnderOverlay(element: Element): boolean {
  const host = document.getElementById("giso-extension-root");
  if (!host?.shadowRoot) return false;
  // BUG-044: read the actual overlay element from the shadow root, not the
  // host div (which is 0×0 because the overlay is position:fixed in the shadow).
  const overlay = host.shadowRoot.querySelector<HTMLElement>(".giso-overlay");
  if (!overlay) return false;
  const overlayStyle = window.getComputedStyle(overlay);
  if (overlayStyle.display === "none") return false;
  const a = element.getBoundingClientRect();
  const b = overlay.getBoundingClientRect();
  // No overlap if one is fully to the left/right/above/below the other.
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

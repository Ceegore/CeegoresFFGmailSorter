// Overlay positioning: drag via header handle, keyboard nudge, viewport clamp,
// reset, and persistence (spec §56.5). Position is the ONLY thing persisted to
// storage.local — never sender data. Temporary evasion for Gmail's move menu
// is never persisted.
import { loadSettings, saveSettings } from "@/settings/storage";

export const DEFAULT_POSITION = { top: 80, right: 16 } as const;
const MIN_VISIBLE_HEADER_PX = 24;
const NUDGE_PX = 8;
const NUDGE_PX_FAST = 32;

export interface Position {
  readonly top: number;
  readonly right: number;
}

export function clampPosition(
  pos: Position,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): Position {
  const maxTop = Math.max(0, viewportHeight - MIN_VISIBLE_HEADER_PX);
  const top = Math.min(Math.max(0, pos.top), maxTop);
  // right is the CSS distance from the right edge: 0 = overlay at the right
  // edge, larger values push it left. minRight keeps the overlay from leaving
  // the right edge; maxRight lets it slide left until at least
  // MIN_VISIBLE_HEADER_PX of the header remains visible on the right.
  const minRight = 0;
  const maxRight = Math.max(0, viewportWidth - MIN_VISIBLE_HEADER_PX);
  const right = Math.min(Math.max(minRight, pos.right), maxRight);
  return { top, right };
}

export function applyPosition(overlay: HTMLElement, pos: Position): void {
  const clamped = clampPosition(pos);
  overlay.style.setProperty("--giso-overlay-top", `${String(clamped.top)}px`);
  overlay.style.setProperty("--giso-overlay-right", `${String(clamped.right)}px`);
}

/**
 * Wire drag (pointer) + keyboard nudge + Escape-restore onto the handle.
 *
 * ITI-020: `initialPosition` seeds both the visual state and the internal
 * `current` so the loaded position never diverges from what is rendered. The
 * caller is responsible for applying the position visually (and loading it
 * from storage) BEFORE wiring so the user cannot drag before the load resolves
 * (ITI-021).
 */
export function wirePositioning(
  overlay: HTMLElement,
  handle: HTMLElement,
  onPersist: (pos: Position) => void,
  initialPosition?: Position,
): () => void {
  let current: Position = initialPosition ?? DEFAULT_POSITION;
  let dragStart: { x: number; y: number; top: number; right: number } | null = null;
  // ITI-020: initialize to current (which may be the loaded position), not
  // DEFAULT_POSITION, so Escape before any drag is a true no-op.
  let preDragPosition: Position = current;
  // ITI-022: debounce persistence so rapid nudges/drag samples collapse into a
  // single trailing write, avoiding last-write races between overlapping
  // persistPosition promises.
  let pendingPersist: Position | null = null;
  let persistTimer: number | null = null;
  const PERSIST_DEBOUNCE_MS = 200;
  const schedulePersist = (pos: Position): void => {
    pendingPersist = pos;
    if (persistTimer !== null) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      if (pendingPersist !== null) {
        const p = pendingPersist;
        pendingPersist = null;
        onPersist(p);
      }
    }, PERSIST_DEBOUNCE_MS);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    dragStart = { x: event.clientX, y: event.clientY, top: current.top, right: current.right };
    preDragPosition = current;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture optional; some test environments lack it */
    }
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    // right decreases as the overlay moves right; top increases as it moves down.
    current = clampPosition({ top: dragStart.top + dy, right: dragStart.right - dx });
    applyPosition(overlay, current);
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (!dragStart) return;
    dragStart = null;
    try {
      handle.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer id may already be released */
    }
    schedulePersist(current);
  };
  // BUG-012: pointercancel fires when the drag is interrupted (e.g. scroll,
  // OS-level gesture, touch stolen). Reset dragStart WITHOUT persisting so the
  // overlay stays at its current visual position rather than snapping back.
  const onPointerCancel = (): void => {
    dragStart = null;
  };
  // lostpointercapture can fire if capture is revoked; abandon the drag too.
  const onLostPointerCapture = (): void => {
    dragStart = null;
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? NUDGE_PX_FAST : NUDGE_PX;
    let next: Position;
    switch (event.key) {
      case "ArrowUp":
        next = { top: current.top - step, right: current.right };
        break;
      case "ArrowDown":
        next = { top: current.top + step, right: current.right };
        break;
      case "ArrowLeft":
        next = { top: current.top, right: current.right + step };
        break;
      case "ArrowRight":
        next = { top: current.top, right: current.right - step };
        break;
      case "Escape":
        // ITI-024: only restore the pre-drag position while a drag is actually
        // active. Without this guard, Escape with no drag in progress would
        // silently move the overlay back to preDragPosition.
        if (dragStart) {
          current = preDragPosition;
          applyPosition(overlay, current);
          dragStart = null;
          schedulePersist(current);
        }
        event.preventDefault();
        return;
      default:
        return;
    }
    event.preventDefault();
    current = clampPosition(next);
    applyPosition(overlay, current);
    schedulePersist(current);
  };
  // ITI-023: re-clamp on resize/zoom so the overlay never ends up fully
  // off-screen when the viewport shrinks.
  const onResize = (): void => {
    current = clampPosition(current);
    applyPosition(overlay, current);
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerCancel);
  handle.addEventListener("lostpointercapture", onLostPointerCapture);
  handle.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);
  handle.tabIndex = 0;

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    handle.removeEventListener("pointercancel", onPointerCancel);
    handle.removeEventListener("lostpointercapture", onLostPointerCapture);
    handle.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
    // ITI-022: cancel any pending trailing write on teardown.
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
      pendingPersist = null;
    }
  };
}

export async function loadPosition(): Promise<Position> {
  const settings = await loadSettings();
  return settings.overlayPosition;
}

export async function persistPosition(pos: Position): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, overlayPosition: pos });
}

export async function resetPosition(): Promise<Position> {
  await persistPosition(DEFAULT_POSITION);
  return DEFAULT_POSITION;
}

export { NUDGE_PX, NUDGE_PX_FAST };

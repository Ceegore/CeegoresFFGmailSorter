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
  const overlayWidth = 380;
  const overlayHeight = Math.min(viewportHeight - 112, viewportHeight);
  const maxTop = Math.max(0, viewportHeight - MIN_VISIBLE_HEADER_PX);
  const maxRight = Math.max(0, viewportWidth - overlayWidth + (viewportWidth - overlayWidth));
  const top = Math.min(Math.max(0, pos.top), maxTop);
  // right is the distance from the right edge; keep >= 0 and ensure the header
  // handle (left side) stays at least MIN_VISIBLE_HEADER_PX inside the viewport.
  const minRight = -(viewportWidth - MIN_VISIBLE_HEADER_PX);
  const right = Math.min(Math.max(minRight, pos.right), Math.max(0, maxRight));
  void overlayHeight;
  return { top, right };
}

export function applyPosition(overlay: HTMLElement, pos: Position): void {
  const clamped = clampPosition(pos);
  overlay.style.setProperty("--giso-overlay-top", `${String(clamped.top)}px`);
  overlay.style.setProperty("--giso-overlay-right", `${String(clamped.right)}px`);
}

/** Wire drag (pointer) + keyboard nudge + Escape-restore onto the handle. */
export function wirePositioning(
  overlay: HTMLElement,
  handle: HTMLElement,
  onPersist: (pos: Position) => void,
): () => void {
  let current: Position = DEFAULT_POSITION;
  let dragStart: { x: number; y: number; top: number; right: number } | null = null;
  let preDragPosition: Position = DEFAULT_POSITION;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    dragStart = { x: event.clientX, y: event.clientY, top: current.top, right: current.right };
    preDragPosition = current;
    handle.setPointerCapture(event.pointerId);
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
    onPersist(current);
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
        current = preDragPosition;
        applyPosition(overlay, current);
        onPersist(current);
        event.preventDefault();
        return;
      default:
        return;
    }
    event.preventDefault();
    current = clampPosition(next);
    applyPosition(overlay, current);
    onPersist(current);
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("keydown", onKeyDown);
  handle.tabIndex = 0;

  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    handle.removeEventListener("keydown", onKeyDown);
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

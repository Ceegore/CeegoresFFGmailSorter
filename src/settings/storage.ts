import { DEFAULT_SETTINGS, type Settings } from "./defaults";

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const record = value as Record<string, unknown>;
  const position = record["overlayPosition"];
  const positionRecord =
    position && typeof position === "object" ? (position as Record<string, unknown>) : null;
  const top = positionRecord?.["top"];
  const right = positionRecord?.["right"];
  const validPosition =
    typeof top === "number" &&
    Number.isFinite(top) &&
    top >= 0 &&
    typeof right === "number" &&
    Number.isFinite(right) &&
    right >= 0;

  // BUG-059: only overlayPosition is validated/persisted.
  return {
    ...DEFAULT_SETTINGS,
    overlayPosition: validPosition ? { top, right } : DEFAULT_SETTINGS.overlayPosition,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get("settings");
  return validateSettings(stored["settings"]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ settings: validateSettings(settings) });
}

// BUG-059: V1 stores only overlayPosition. The diagnosticsEnabled and
// autoOpenMoveMenu settings were stored but never read by any code — removed
// to avoid shipping dead configuration that implies non-existent features.
export interface StoredSettingsV1 {
  readonly schemaVersion: 1;
  readonly overlayPosition: Readonly<{ top: number; right: number }>;
}

export type Settings = StoredSettingsV1;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  overlayPosition: { top: 80, right: 16 },
};

export interface StoredSettingsV1 {
  readonly schemaVersion: 1;
  readonly overlayPosition: Readonly<{ top: number; right: number }>;
  readonly diagnosticsEnabled: boolean;
  readonly autoOpenMoveMenu: boolean;
}

export type Settings = StoredSettingsV1;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  overlayPosition: { top: 80, right: 16 },
  diagnosticsEnabled: false,
  autoOpenMoveMenu: true,
};

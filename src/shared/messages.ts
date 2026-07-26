export type BackgroundToContentMessage =
  Readonly<{ type: "TOGGLE_OVERLAY" }> | Readonly<{ type: "SHOW_OVERLAY" }>;

export interface ContentResponse {
  readonly ok: boolean;
  readonly overlayVisible?: boolean;
  readonly error?: string;
}

export function isContentResponse(value: unknown): value is ContentResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["ok"] === "boolean" &&
    (record["overlayVisible"] === undefined || typeof record["overlayVisible"] === "boolean") &&
    (record["error"] === undefined || typeof record["error"] === "string")
  );
}

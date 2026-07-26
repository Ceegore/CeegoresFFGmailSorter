export type ErrorCode =
  | "GISO-SHELL-001"
  | "GISO-VIEW-NOT-INBOX-001"
  | "GISO-LIST-001"
  | "GISO-ROWS-001"
  | "GISO-SENDER-CONFLICT-001"
  | "GISO-SENDER-UNRESOLVED-001"
  | "GISO-SEARCH-BOX-001"
  | "GISO-SEARCH-MISMATCH-001"
  | "GISO-SEARCH-TIMEOUT-001"
  | "GISO-SEARCH-EMPTY-001"
  | "GISO-SEARCH-RELATED-ONLY-001"
  | "GISO-SELECT-PAGE-001"
  | "GISO-SELECT-PAGE-002"
  | "GISO-SELECT-ALL-001"
  | "GISO-MOVE-001"
  | "GISO-MOVE-002"
  | "GISO-COMPLETION-UNCERTAIN-001"
  | "GISO-STATE-ILLEGAL-001"
  | "GISO-ABORT-001"
  | "GISO-DOM-CHANGED-001"
  | "GISO-INTERNAL-001";

export interface AppError {
  readonly code: ErrorCode;
  readonly userMessageKey: string;
  readonly technicalMessage: string;
  readonly recoverable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function appError(
  code: ErrorCode,
  userMessageKey: string,
  technicalMessage: string,
  recoverable: boolean,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return { code, userMessageKey, technicalMessage, recoverable, ...(details ? { details } : {}) };
}

/**
 * Thrown error carrying an AppError payload. Throwing an Error instance keeps
 * eslint's only-throw-error rule satisfied while letting callers recover the
 * structured AppError via `toAppError`.
 */
export class GisoError extends Error {
  readonly app: AppError;
  constructor(app: AppError) {
    super(app.technicalMessage);
    this.name = "GisoError";
    this.app = app;
  }
}

export function throwAppError(app: AppError): never {
  throw new GisoError(app);
}

export function toAppError(value: unknown): AppError {
  if (value instanceof GisoError) return value.app;
  if (value instanceof Error) {
    return appError("GISO-INTERNAL-001", "internal", value.message, true);
  }
  return appError("GISO-INTERNAL-001", "internal", String(value), true);
}

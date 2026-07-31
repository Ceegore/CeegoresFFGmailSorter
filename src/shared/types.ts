import type { AppError } from "./errors";

export type Confidence = "high" | "medium" | "low" | "unresolved";

export interface SenderIdentity {
  readonly normalizedEmail: string | null;
  readonly rawEmail: string | null;
  readonly displayName: string | null;
  readonly source:
    | "email-attribute"
    | "hovercard-id"
    | "data-email"
    | "title"
    | "aria-label"
    | "visible-text"
    | "hovercard"
    | "none";
  readonly confidence: Confidence;
  readonly diagnostics: readonly string[];
}

export interface AnalyzedEntry {
  readonly fingerprint: string;
  readonly sender: SenderIdentity;
  readonly rowIndex: number;
}

export type GroupStatus = "ready" | "ignored" | "in-progress" | "done" | "error";

export interface SenderGroup {
  readonly id: string;
  readonly normalizedEmail: string;
  readonly displayNames: readonly string[];
  readonly primaryDisplayName: string;
  readonly visibleEntryCount: number;
  readonly sourceFingerprints: readonly string[];
  readonly confidence: "high" | "medium";
  readonly status: GroupStatus;
  readonly lastErrorCode?: string;
}

export interface AnalysisResult {
  readonly startedAt: number;
  readonly completedAt: number;
  readonly sourceRoute: Readonly<{
    accountSlot: number | null;
    view: string;
    fingerprint: string;
  }>;
  readonly rowCount: number;
  readonly resolvedCount: number;
  readonly unresolvedCount: number;
  readonly duplicateCount: number;
  readonly weakFingerprintCount: number;
  readonly groups: readonly SenderGroup[];
  readonly unresolvedEntries: readonly AnalyzedEntry[];
}

export type WorkflowState =
  | "IDLE"
  | "ANALYZING"
  | "RESULTS_READY"
  | "CONFIRM_SEARCH"
  | "SETTING_SEARCH"
  | "WAITING_SEARCH_RESULTS"
  | "SEARCH_READY_MANUAL"
  | "SELECTING_PAGE"
  | "WAITING_SELECT_ALL"
  | "MANUAL_SELECT_ALL"
  | "OPENING_MOVE_MENU"
  | "WAITING_TARGET_SELECTION"
  | "VERIFYING_COMPLETION"
  | "COMPLETED"
  | "CANCELLED"
  | "ERROR";

export type WorkflowStep = "search" | "select-page" | "select-all" | "open-move" | "choose-target";
export type StepStatus = "pending" | "active" | "done" | "help" | "failed";

export interface DiagnosticEvent {
  readonly timestamp: number;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AppState {
  readonly overlayVisible: boolean;
  readonly workflow: WorkflowState;
  readonly analysis: AnalysisResult | null;
  readonly activeGroupId: string | null;
  readonly expectedQuery: string | null;
  readonly error: AppError | null;
  readonly filter: string;
  readonly sort: "count" | "name" | "address";
  readonly diagnostics: readonly DiagnosticEvent[];
}

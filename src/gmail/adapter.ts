// Gmail DOM adapter contracts (spec §13.1, §51). The adapter ONLY detects and
// scores candidates; it never decides whether to click — that is the workflow
// layer's job, using the thresholds in §51.3. Business logic must never hold a
// Gmail CSS class.
import type { SenderIdentity } from "@/shared/types";

export interface Detection<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly errorCode?: string;
  readonly candidateCount?: number;
}

export interface GmailShell {
  readonly mainRoot: HTMLElement;
  readonly locale: "de" | "en" | "unknown";
}

export interface GmailView {
  readonly isInboxLike: boolean;
  readonly isSearchActive: boolean;
  readonly accountSlot: number | null;
  readonly viewClass: string;
}

// Design contract (spec §13.1): the types below are the target adapter
// architecture. GmailDomAdapter and SelectionState are not yet wired into the
// runtime detection layer; detectionOk/detectionFail/requireDetection are in use.
export type SelectionState = "none" | "page" | "partial" | "all";

export interface CompletionContext {
  readonly expectedQuery: string | null;
  readonly baselineResultCount: number | null;
}

export interface CompletionEvidence {
  readonly snackbarMoveText: boolean;
  readonly menuClosedAfterInteraction: boolean;
  readonly resultCountDecreased: boolean;
  readonly resultListEmpty: boolean;
  readonly inboxMatchesAbsent: boolean;
  readonly undoVisible: boolean;
  readonly score: number;
}

// Design contract (spec §13.1, §51): not yet implemented in production — the
// live detection layer (dom-detectors.ts) covers these concerns today. Kept as
// the target adapter interface the detection layer should converge on.
export interface GmailDomAdapter {
  detectShell(): Detection<GmailShell>;
  detectCurrentView(): Detection<GmailView>;
  findSearchBox(): Detection<HTMLInputElement>;
  findMessageList(): Detection<HTMLElement>;
  findMessageRows(list: HTMLElement): Detection<HTMLElement[]>;
  extractSender(row: HTMLElement): SenderIdentity;
  findPageSelectControl(): Detection<HTMLElement>;
  detectPageSelection(): Detection<SelectionState>;
  findSelectAllMatchesControl(): Detection<HTMLElement | null>;
  detectAllMatchesSelected(): Detection<boolean>;
  findMoveControl(): Detection<HTMLElement>;
  detectMoveMenu(): Detection<HTMLElement>;
  detectCompletion(context: CompletionContext): Detection<CompletionEvidence>;
}

export function detectionOk<T>(
  value: T,
  confidence: number,
  evidence: readonly string[],
  candidateCount?: number,
): Detection<T> {
  return {
    ok: true,
    value,
    confidence,
    evidence,
    ...(candidateCount !== undefined ? { candidateCount } : {}),
  };
}

export function detectionFail<T>(
  confidence: number,
  evidence: readonly string[],
  errorCode?: string,
  candidateCount?: number,
): Detection<T> {
  return {
    ok: false,
    confidence,
    evidence,
    ...(errorCode ? { errorCode } : {}),
    ...(candidateCount !== undefined ? { candidateCount } : {}),
  };
}

export function requireDetection<T>(d: Detection<T>): T {
  if (!d.ok || d.value === undefined) {
    throw new Error(
      `Required detection failed: ${d.errorCode ?? "unknown"} (${d.evidence.join("; ")})`,
    );
  }
  return d.value;
}

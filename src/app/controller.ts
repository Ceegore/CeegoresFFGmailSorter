// Application controller. Owns at most one AbortController, drives effects
// only after a successful state transition, and translates unknown exceptions
// to GISO-INTERNAL-001 (spec appendix A.11). Effect orchestration is filled in
// across Phases 04–08; the public contract below is stable.
import { isAbortError } from "@/shared/abort";
import { appError, GisoError } from "@/shared/errors";
import type { ContentResponse } from "@/shared/messages";
import type { Store } from "@/app/store";
import type { AppEvent } from "@/app/events";
import type { AppState } from "@/shared/types";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";
import { buildInboxSenderQuery, submitAndWaitUntilReady } from "@/gmail/search-controller";
import { selectCurrentPage, trySelectAllMatches } from "@/gmail/selection-controller";
import { openMoveMenu } from "@/gmail/move-controller";
import { isAutoConfirmed, readCompletionEvidence } from "@/gmail/completion-detector";

export interface AppController {
  readonly analyze: () => Promise<void>;
  readonly selectGroup: (groupId: string) => void;
  readonly confirmSearch: () => Promise<void>;
  readonly confirmManualSelection: () => Promise<void>;
  readonly reopenMoveMenu: () => Promise<void>;
  readonly confirmCompletion: () => void;
  readonly cancel: (reason?: string) => void;
  readonly resetSession: () => void;
  readonly returnToResults: () => void;
  readonly setFilter: (value: string) => void;
  readonly setSort: (value: AppState["sort"]) => void;
  readonly ignoreGroup: (groupId: string) => void;
  readonly handleBackgroundMessage: (
    type: "TOGGLE_OVERLAY" | "SHOW_OVERLAY",
  ) => ContentResponse | Promise<ContentResponse>;
  readonly dispose: () => void;
}

function toTechnicalMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? ` (cause: ${error.cause.message})`
        : error.cause
          ? ` (cause)`
          : "";
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}

export function createAppController(store: Store<AppState, AppEvent>): AppController {
  let abortController: AbortController | null = null;

  const dispatch = (event: AppEvent): void => {
    store.dispatch(event);
  };
  const restoreActiveGroupToReady = (): void => {
    const { activeGroupId, analysis } = store.getState();
    if (!activeGroupId || !analysis) return;
    const group = analysis.groups.find((g) => g.id === activeGroupId);
    if (group?.status === "in-progress") {
      dispatch({ type: "MARK_GROUP_READY", groupId: activeGroupId });
    }
  };
  // Open the native move menu, transition to WAITING_TARGET_SELECTION, then
  // read completion evidence. The user chooses the label in Gmail (§55.3); we
  // only observe. Auto-confirm at threshold, else leave VERIFYING_COMPLETION
  // for confirmCompletion() (user "Ich bin fertig").
  const openMoveAndAwaitTarget = async (groupId: string, signal: AbortSignal): Promise<void> => {
    await openMoveMenu(signal);
    dispatch({ type: "MOVE_MENU_OPENED" });
    dispatch({ type: "TARGET_CHOICE_DETECTED" });
    const baseline = document.querySelectorAll('[role="listitem"], tr[role="row"]').length;
    const evidence = readCompletionEvidence({
      expectedQuery: store.getState().expectedQuery,
      baselineResultCount: baseline,
    });
    if (isAutoConfirmed(evidence)) {
      dispatch({ type: "COMPLETION_CONFIRMED" });
      dispatch({ type: "MARK_GROUP_DONE", groupId });
    }
    // Otherwise the UI shows the manual "Ich bin fertig" button -> confirmCompletion().
  };
  const safeRun = async (task: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;
    try {
      await task(signal);
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      // Preserve a structured GisoError's code/message; wrap anything else.
      const wrapped =
        error instanceof GisoError
          ? error.app
          : appError("GISO-INTERNAL-001", "internal", toTechnicalMessage(error), true);
      dispatch({ type: "FAIL", error: wrapped });
    }
  };

  return {
    async analyze(): Promise<void> {
      dispatch({ type: "START_ANALYSIS" });
      await safeRun(async (signal) => {
        const result = await analyzeCurrentInbox(signal);
        dispatch({ type: "ANALYSIS_SUCCEEDED", result });
      });
    },
    selectGroup(groupId: string): void {
      dispatch({ type: "SELECT_GROUP", groupId });
    },
    async confirmSearch(): Promise<void> {
      dispatch({ type: "CONFIRM_SEARCH" });
      await safeRun(async (signal) => {
        const state = store.getState();
        const group = state.analysis?.groups.find((g) => g.id === state.activeGroupId);
        if (!group) {
          dispatch({
            type: "FAIL",
            error: appError("GISO-INTERNAL-001", "internal", "no active group", true),
          });
          return;
        }
        // Fix F-001: mark the group in-progress so completion/error can advance it.
        dispatch({ type: "MARK_GROUP_IN_PROGRESS", groupId: group.id });
        const query = buildInboxSenderQuery(group.normalizedEmail);
        dispatch({ type: "SEARCH_SUBMITTED", query });
        const evidence = await submitAndWaitUntilReady(query, signal);
        // Empty results end the workflow for this group with an error.
        if (evidence.emptyStateDetected && !evidence.mailListDetected) {
          dispatch({
            type: "MARK_GROUP_ERROR",
            groupId: group.id,
            errorCode: "GISO-SEARCH-EMPTY-001",
          });
          dispatch({
            type: "FAIL",
            error: appError("GISO-SEARCH-EMPTY-001", "searchFailed", "no results", true),
          });
          return;
        }
        dispatch({ type: "SEARCH_READY" });

        // Phase 06: select current page, then attempt select-all.
        await selectCurrentPage(signal);
        dispatch({ type: "PAGE_SELECTED" });
        const outcome = await trySelectAllMatches(signal);
        if (outcome === "manual-required") {
          dispatch({ type: "MANUAL_SELECT_REQUIRED" });
          return; // wait for confirmManualSelection()
        }
        dispatch({ type: "ALL_SELECTED" });
        await openMoveAndAwaitTarget(group.id, signal);
      });
    },
    async confirmManualSelection(): Promise<void> {
      dispatch({ type: "MANUAL_SELECT_CONFIRMED" });
      await safeRun(async (signal) => {
        const id = store.getState().activeGroupId;
        if (id) await openMoveAndAwaitTarget(id, signal);
      });
    },
    async reopenMoveMenu(): Promise<void> {
      await safeRun(async (signal) => {
        const id = store.getState().activeGroupId;
        if (id) await openMoveAndAwaitTarget(id, signal);
      });
    },
    confirmCompletion(): void {
      const id = store.getState().activeGroupId;
      dispatch({ type: "COMPLETION_CONFIRMED" });
      if (id) dispatch({ type: "MARK_GROUP_DONE", groupId: id });
    },
    cancel(): void {
      abortController?.abort();
      abortController = null;
      // Per A.11: abort without completion restores the active group to ready.
      restoreActiveGroupToReady();
      dispatch({ type: "CANCELLED" });
    },
    resetSession(): void {
      abortController?.abort();
      abortController = null;
      restoreActiveGroupToReady();
      dispatch({ type: "RETURN_TO_RESULTS" });
    },
    returnToResults(): void {
      abortController?.abort();
      abortController = null;
      dispatch({ type: "RETURN_TO_RESULTS" });
    },
    setFilter(value: string): void {
      dispatch({ type: "SET_FILTER", value });
    },
    setSort(value: AppState["sort"]): void {
      dispatch({ type: "SET_SORT", value });
    },
    ignoreGroup(groupId: string): void {
      dispatch({ type: "IGNORE_GROUP", groupId });
    },
    handleBackgroundMessage(type): ContentResponse | Promise<ContentResponse> {
      try {
        dispatch({ type });
        return { ok: true, overlayVisible: store.getState().overlayVisible };
      } catch (error: unknown) {
        return { ok: false, error: error instanceof Error ? error.message : "controller error" };
      }
    },
    dispose(): void {
      abortController?.abort();
      abortController = null;
    },
  };
}

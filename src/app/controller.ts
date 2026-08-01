// Application controller. Owns at most one AbortController, drives effects
// only after a successful state transition, and translates unknown exceptions
// to GISO-INTERNAL-001 (spec appendix A.11). Effect orchestration is filled in
// across Phases 04–08; the public contract below is stable.
import { isAbortError } from "@/shared/abort";
import { appError, GisoError } from "@/shared/errors";
import type { ContentResponse } from "@/shared/messages";
import type { Store } from "@/app/store";
import type { AppEvent } from "@/app/events";
import { isCriticalWorkflow } from "@/app/state-machine";
import type { AppState } from "@/shared/types";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";
import { buildInboxSenderQuery, submitAndWaitUntilReady } from "@/gmail/search-controller";
import { selectCurrentPage, trySelectAllMatches } from "@/gmail/selection-controller";
import { openMoveMenu } from "@/gmail/move-controller";
import { isAutoConfirmed, readCompletionEvidence } from "@/gmail/completion-detector";
import { SAFE_MODE } from "@/shared/constants";

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
  /** ITI-003: restore an errored group to ready status for retry. */
  readonly restoreGroup: (groupId: string) => void;
  /** Invalidate the session on an unexpected route/account change (BUG-004/035). */
  readonly invalidateOnRouteChange: () => void;
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
  // BUG-035: while the workflow is driving its own search navigation, route
  // changes are expected and must NOT invalidate the session.
  let expectedRouteTransition = false;
  let expectedRouteGraceUntil = 0;

  const dispatch = (event: AppEvent): { accepted: boolean } => {
    return store.dispatch(event);
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
      // ITI-002 / BUG-008: preserve a structured GisoError's code/message;
      // wrap anything else. When there is an active group, use WORKFLOW_FAILED
      // for BOTH cases so the group is marked error atomically and is never
      // left stranded in-progress (GisoError used to dispatch plain FAIL). With
      // no active group, fall back to plain FAIL.
      const groupId = store.getState().activeGroupId;
      const wrapped =
        error instanceof GisoError
          ? error.app
          : appError("GISO-INTERNAL-001", "internal", toTechnicalMessage(error), true);
      if (groupId) {
        dispatch({ type: "WORKFLOW_FAILED", groupId, error: wrapped });
      } else {
        dispatch({ type: "FAIL", error: wrapped });
      }
    }
  };

  return {
    async analyze(): Promise<void> {
      // BUG-010: only run the effect if the transition was actually accepted.
      if (!dispatch({ type: "START_ANALYSIS" }).accepted) return;
      await safeRun(async (signal) => {
        const result = await analyzeCurrentInbox(signal);
        dispatch({ type: "ANALYSIS_SUCCEEDED", result });
      });
    },
    selectGroup(groupId: string): void {
      dispatch({ type: "SELECT_GROUP", groupId });
    },
    async confirmSearch(): Promise<void> {
      if (!dispatch({ type: "CONFIRM_SEARCH" }).accepted) return;
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
        if (!dispatch({ type: "MARK_GROUP_IN_PROGRESS", groupId: group.id }).accepted) {
          dispatch({
            type: "FAIL",
            error: appError(
              "GISO-INTERNAL-001",
              "internal",
              "could not mark group in-progress",
              true,
            ),
          });
          return;
        }
        const query = buildInboxSenderQuery(group.normalizedEmail);
        dispatch({ type: "SEARCH_SUBMITTED", query });
        // BUG-035: the search will navigate Gmail's route; that is expected.
        expectedRouteTransition = true;
        let evidence: Awaited<ReturnType<typeof submitAndWaitUntilReady>>;
        try {
          evidence = await submitAndWaitUntilReady(query, signal);
        } finally {
          expectedRouteTransition = false;
          expectedRouteGraceUntil = performance.now() + 3000; // 3s grace for debounced observer
        }
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
        // SAFE_MODE is a deliberate compile-time constant gate (Phase A). The
        // always-truthy condition is intentional and flips back once click-safety
        // bugs are closed.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (SAFE_MODE) {
          // Phase A safety cut: do NOT auto-select / auto-move / auto-complete.
          // Surface the query and let the user act manually in Gmail.
          dispatch({ type: "SEARCH_READY_MANUAL" });
          return;
        }

        // Automated path (re-enabled only when SAFE_MODE === false and
        // Phases B–D have closed the click-safety defects).
        dispatch({ type: "SEARCH_READY" });
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
      // SAFE_MODE: the automated move path is disabled; this is a no-op.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (SAFE_MODE) return;
      if (!dispatch({ type: "MANUAL_SELECT_CONFIRMED" }).accepted) return;
      await safeRun(async (signal) => {
        const id = store.getState().activeGroupId;
        if (id) await openMoveAndAwaitTarget(id, signal);
      });
    },
    async reopenMoveMenu(): Promise<void> {
      // SAFE_MODE: the automated move path is disabled; this is a no-op.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (SAFE_MODE) return;
      await safeRun(async (signal) => {
        const id = store.getState().activeGroupId;
        if (id) await openMoveAndAwaitTarget(id, signal);
      });
    },
    confirmCompletion(): void {
      const { activeGroupId, workflow } = store.getState();
      if (workflow === "SEARCH_READY_MANUAL") {
        // Safe-mode manual completion: mark the group done and return to results.
        if (activeGroupId) dispatch({ type: "MARK_GROUP_DONE", groupId: activeGroupId });
        dispatch({ type: "RETURN_TO_RESULTS" });
        return;
      }
      // COMPLETION_CONFIRMED is only legal from VERIFYING_COMPLETION. If the
      // user is still choosing a target, detour through TARGET_CHOICE_DETECTED
      // first. If neither, do nothing (avoid an illegal dispatch).
      if (workflow === "WAITING_TARGET_SELECTION") {
        dispatch({ type: "TARGET_CHOICE_DETECTED" });
      } else if (workflow !== "VERIFYING_COMPLETION") {
        return;
      }
      const id = activeGroupId;
      dispatch({ type: "COMPLETION_CONFIRMED" });
      if (id) dispatch({ type: "MARK_GROUP_DONE", groupId: id });
    },
    cancel(): void {
      abortController?.abort();
      abortController = null;
      const { workflow } = store.getState();
      // Per A.11: abort without completion restores the active group to ready.
      restoreActiveGroupToReady();
      // CANCELLED is only legal from ANALYZING or a critical workflow. Guard it
      // so the IDLE/terminal "Close" button does not emit illegal dispatches.
      const analyseOrCritical = workflow === "ANALYZING" || isCriticalWorkflow(workflow);
      let cancelled = false;
      if (analyseOrCritical) {
        cancelled = dispatch({ type: "CANCELLED" }).accepted;
      }
      const terminal = ["ERROR", "COMPLETED", "CANCELLED", "SEARCH_READY_MANUAL", "CONFIRM_SEARCH"];
      // RETURN_TO_RESULTS is legal from terminal states. Follow CANCELLED with
      // it so the user never gets stuck in CANCELLED. If CANCELLED was
      // rejected (or skipped) and we are not already terminal, the workflow is
      // IDLE/RESULTS_READY — just hide the overlay.
      if (cancelled || terminal.includes(workflow)) {
        dispatch({ type: "RETURN_TO_RESULTS" });
      } else {
        dispatch({ type: "TOGGLE_OVERLAY" });
      }
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
      // ITI-001: restore the active group to ready before returning. Otherwise a
      // Back from SEARCH_READY_MANUAL/WAITING_* leaves the group permanently
      // in-progress and unactionable.
      restoreActiveGroupToReady();
      dispatch({ type: "RETURN_TO_RESULTS" });
    },
    invalidateOnRouteChange(): void {
      // BUG-004/035: ignore route changes the workflow itself is driving.
      if (expectedRouteTransition || performance.now() < expectedRouteGraceUntil) return;
      abortController?.abort();
      abortController = null;
      dispatch({ type: "ROUTE_CONTEXT_INVALIDATED" });
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
    restoreGroup(groupId: string): void {
      // ITI-003: MARK_GROUP_READY restores an errored (or in-progress) group so
      // the user can retry from the results list.
      dispatch({ type: "MARK_GROUP_READY", groupId });
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

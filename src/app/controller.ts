// Application controller. Owns at most one AbortController, drives effects
// only after a successful state transition, and translates unknown exceptions
// to GISO-INTERNAL-001 (spec appendix A.11). Effect orchestration is filled in
// across Phases 04–08; the public contract below is stable.
import { isAbortError } from "@/shared/abort";
import { appError } from "@/shared/errors";
import type { ContentResponse } from "@/shared/messages";
import type { Store } from "@/app/store";
import type { AppEvent } from "@/app/events";
import type { AppState } from "@/shared/types";
import { analyzeCurrentInbox } from "@/analyzer/inbox-analyzer";

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
  const safeRun = async (task: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;
    try {
      await task(signal);
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      dispatch({
        type: "FAIL",
        error: appError("GISO-INTERNAL-001", "internal", toTechnicalMessage(error), true),
      });
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
      // Phase 05 wires submit + waitUntilReady here.
      await Promise.resolve();
    },
    async confirmManualSelection(): Promise<void> {
      dispatch({ type: "MANUAL_SELECT_CONFIRMED" });
      await Promise.resolve();
    },
    async reopenMoveMenu(): Promise<void> {
      // Phase 07 re-resolves and clicks the move button on explicit user request.
      await Promise.resolve();
    },
    confirmCompletion(): void {
      dispatch({ type: "COMPLETION_CONFIRMED" });
    },
    cancel(): void {
      abortController?.abort();
      abortController = null;
      dispatch({ type: "CANCELLED" });
    },
    resetSession(): void {
      abortController?.abort();
      abortController = null;
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

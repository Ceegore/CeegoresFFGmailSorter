import { buildInboxSenderQuery } from "@/gmail/search-controller";
import { initialState } from "@/app/initial-state";
import type {
  AppState,
  DiagnosticEvent,
  SenderGroup,
  StepStatus,
  WorkflowState,
  WorkflowStep,
} from "@/shared/types";
import type { AppEvent } from "./events";

const MAX_DIAGNOSTICS = 500;
const CRITICAL: ReadonlySet<WorkflowState> = new Set([
  "SETTING_SEARCH",
  "WAITING_SEARCH_RESULTS",
  "SELECTING_PAGE",
  "WAITING_SELECT_ALL",
  "MANUAL_SELECT_ALL",
  "OPENING_MOVE_MENU",
  "WAITING_TARGET_SELECTION",
  "VERIFYING_COMPLETION",
]);

export function isCriticalWorkflow(workflow: WorkflowState): boolean {
  return CRITICAL.has(workflow);
}

export function appendDiagnostic(
  state: AppState,
  event: DiagnosticEvent,
): readonly DiagnosticEvent[] {
  return [...state.diagnostics, event].slice(-MAX_DIAGNOSTICS);
}

export function deriveSteps(workflow: WorkflowState): Readonly<Record<WorkflowStep, StepStatus>> {
  const order: readonly WorkflowStep[] = [
    "search",
    "select-page",
    "select-all",
    "open-move",
    "choose-target",
  ];
  const activeIndex: Partial<Record<WorkflowState, number>> = {
    SETTING_SEARCH: 0,
    WAITING_SEARCH_RESULTS: 0,
    SELECTING_PAGE: 1,
    WAITING_SELECT_ALL: 2,
    MANUAL_SELECT_ALL: 2,
    OPENING_MOVE_MENU: 3,
    WAITING_TARGET_SELECTION: 4,
    VERIFYING_COMPLETION: 4,
    COMPLETED: 5,
  };
  const index = activeIndex[workflow] ?? -1;
  return Object.fromEntries(
    order.map((step, itemIndex) => [
      step,
      itemIndex < index
        ? "done"
        : itemIndex === index
          ? workflow === "MANUAL_SELECT_ALL"
            ? "help"
            : "active"
          : "pending",
    ]),
  ) as Readonly<Record<WorkflowStep, StepStatus>>;
}

function illegal(state: AppState, event: AppEvent): AppState {
  return {
    ...state,
    diagnostics: appendDiagnostic(state, {
      timestamp: Date.now(),
      level: "error",
      code: "GISO-STATE-ILLEGAL-001",
      message: `Illegal ${event.type} transition from ${state.workflow}`,
    }),
  };
}

function replaceGroup(
  state: AppState,
  groupId: string,
  updater: (group: SenderGroup) => SenderGroup,
): AppState | null {
  if (!state.analysis) return null;
  const index = state.analysis.groups.findIndex((group) => group.id === groupId);
  if (index < 0) return null;
  return {
    ...state,
    analysis: {
      ...state.analysis,
      groups: state.analysis.groups.map((group) => (group.id === groupId ? updater(group) : group)),
    },
  };
}

function updateGroupEvent(
  state: AppState,
  event: Extract<
    AppEvent,
    {
      type:
        | "IGNORE_GROUP"
        | "MARK_GROUP_IN_PROGRESS"
        | "MARK_GROUP_READY"
        | "MARK_GROUP_DONE"
        | "MARK_GROUP_ERROR";
    }
  >,
): AppState {
  // BUG-051: group-status events are bound to workflow + active group.
  // IGNORE_GROUP is only legal from RESULTS_READY; the workflow-bound status
  // events (IN_PROGRESS/READY/DONE/ERROR) only apply to the active group.
  if (event.type === "IGNORE_GROUP") {
    if (state.workflow !== "RESULTS_READY") return illegal(state, event);
  } else {
    if (event.groupId !== state.activeGroupId) return illegal(state, event);
  }
  const next = replaceGroup(state, event.groupId, (group) => {
    switch (event.type) {
      case "IGNORE_GROUP":
        return group.status === "ready" ? { ...group, status: "ignored" } : group;
      case "MARK_GROUP_IN_PROGRESS":
        return group.status === "ready" ? { ...group, status: "in-progress" } : group;
      case "MARK_GROUP_READY": {
        if (!["in-progress", "error"].includes(group.status)) return group;
        const { lastErrorCode: _discarded, ...withoutError } = group;
        return { ...withoutError, status: "ready" };
      }
      case "MARK_GROUP_DONE": {
        if (!["in-progress", "ready"].includes(group.status)) return group;
        const { lastErrorCode: _discarded, ...withoutError } = group;
        return { ...withoutError, status: "done" };
      }
      case "MARK_GROUP_ERROR":
        return group.status === "in-progress"
          ? { ...group, status: "error", lastErrorCode: event.errorCode }
          : group;
    }
  });
  if (!next || next === state) return illegal(state, event);
  const before = state.analysis?.groups.find((group) => group.id === event.groupId);
  const after = next.analysis?.groups.find((group) => group.id === event.groupId);
  return before === after || before?.status === after?.status ? illegal(state, event) : next;
}

export function reduceAppState(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "TOGGLE_OVERLAY":
      return isCriticalWorkflow(state.workflow)
        ? { ...state, overlayVisible: true }
        : { ...state, overlayVisible: !state.overlayVisible };
    case "SHOW_OVERLAY":
      return { ...state, overlayVisible: true };
    case "SET_FILTER":
      return { ...state, filter: event.value };
    case "SET_SORT":
      return { ...state, sort: event.value };
    case "START_ANALYSIS":
      return ["IDLE", "RESULTS_READY"].includes(state.workflow)
        ? {
            ...state,
            // BUG-040: clear the previous analysis immediately so a failed
            // re-analysis cannot resurface stale groups from another route/account.
            analysis: null,
            workflow: "ANALYZING",
            error: null,
            activeGroupId: null,
            expectedQuery: null,
          }
        : illegal(state, event);
    case "ANALYSIS_SUCCEEDED":
      return state.workflow === "ANALYZING"
        ? { ...state, workflow: "RESULTS_READY", analysis: event.result, error: null }
        : illegal(state, event);
    case "ANALYSIS_FAILED":
      return state.workflow === "ANALYZING"
        ? { ...state, workflow: "ERROR", error: event.error }
        : illegal(state, event);
    case "SELECT_GROUP": {
      const group = state.analysis?.groups.find((candidate) => candidate.id === event.groupId);
      return state.workflow === "RESULTS_READY" && group?.status === "ready"
        ? { ...state, workflow: "CONFIRM_SEARCH", activeGroupId: group.id, error: null }
        : illegal(state, event);
    }
    case "CONFIRM_SEARCH":
      return state.workflow === "CONFIRM_SEARCH"
        ? { ...state, workflow: "SETTING_SEARCH" }
        : illegal(state, event);
    case "SEARCH_SUBMITTED": {
      const group = state.analysis?.groups.find(
        (candidate) => candidate.id === state.activeGroupId,
      );
      const expected = group ? buildInboxSenderQuery(group.normalizedEmail) : null;
      return state.workflow === "SETTING_SEARCH" && expected === event.query
        ? { ...state, workflow: "WAITING_SEARCH_RESULTS", expectedQuery: event.query }
        : illegal(state, event);
    }
    case "SEARCH_READY":
      return state.workflow === "WAITING_SEARCH_RESULTS"
        ? { ...state, workflow: "SELECTING_PAGE" }
        : illegal(state, event);
    case "SEARCH_READY_MANUAL":
      // Phase A safe mode: after a verified search, stop for manual operation.
      return state.workflow === "WAITING_SEARCH_RESULTS"
        ? { ...state, workflow: "SEARCH_READY_MANUAL" }
        : illegal(state, event);
    case "PAGE_SELECTED":
      return state.workflow === "SELECTING_PAGE"
        ? { ...state, workflow: "WAITING_SELECT_ALL" }
        : illegal(state, event);
    case "ALL_SELECTED":
      return state.workflow === "WAITING_SELECT_ALL"
        ? { ...state, workflow: "OPENING_MOVE_MENU" }
        : illegal(state, event);
    case "MANUAL_SELECT_REQUIRED":
      return ["SELECTING_PAGE", "WAITING_SELECT_ALL"].includes(state.workflow)
        ? { ...state, workflow: "MANUAL_SELECT_ALL" }
        : illegal(state, event);
    case "MANUAL_SELECT_CONFIRMED":
      return state.workflow === "MANUAL_SELECT_ALL"
        ? { ...state, workflow: "OPENING_MOVE_MENU" }
        : illegal(state, event);
    case "MOVE_MENU_OPENED":
      return state.workflow === "OPENING_MOVE_MENU"
        ? { ...state, workflow: "WAITING_TARGET_SELECTION" }
        : illegal(state, event);
    case "TARGET_CHOICE_DETECTED":
      return state.workflow === "WAITING_TARGET_SELECTION"
        ? { ...state, workflow: "VERIFYING_COMPLETION" }
        : illegal(state, event);
    case "COMPLETION_CONFIRMED":
      return state.workflow === "VERIFYING_COMPLETION"
        ? { ...state, workflow: "COMPLETED" }
        : illegal(state, event);
    case "FAIL":
      return state.workflow === "ANALYZING" || isCriticalWorkflow(state.workflow)
        ? { ...state, workflow: "ERROR", error: event.error }
        : illegal(state, event);
    case "WORKFLOW_FAILED": {
      // BUG-008: atomically mark the active group as error AND fail the workflow,
      // so a group is never left stuck as in-progress after an error.
      if (state.workflow === "ANALYZING" || isCriticalWorkflow(state.workflow)) {
        if (!state.analysis || event.groupId !== state.activeGroupId) {
          return { ...state, workflow: "ERROR", error: event.error };
        }
        const groups = state.analysis.groups.map((g) =>
          g.id === event.groupId && g.status === "in-progress"
            ? { ...g, status: "error" as const, lastErrorCode: event.error.code }
            : g,
        );
        return {
          ...state,
          workflow: "ERROR",
          error: event.error,
          analysis: { ...state.analysis, groups },
        };
      }
      return illegal(state, event);
    }
    case "CANCELLED":
      return state.workflow === "ANALYZING" || isCriticalWorkflow(state.workflow)
        ? { ...state, workflow: "CANCELLED", error: null }
        : illegal(state, event);
    case "ROUTE_CONTEXT_INVALIDATED":
      // BUG-004: atomically discard all session state on a route/account change.
      return {
        ...initialState,
        overlayVisible: state.overlayVisible,
      };
    case "RETURN_TO_RESULTS":
      return ["COMPLETED", "CANCELLED", "ERROR", "SEARCH_READY_MANUAL", "CONFIRM_SEARCH"].includes(
        state.workflow,
      )
        ? state.analysis
          ? {
              ...state,
              workflow: "RESULTS_READY",
              activeGroupId: null,
              expectedQuery: null,
              error: null,
            }
          : { ...state, workflow: "IDLE", activeGroupId: null, expectedQuery: null, error: null }
        : illegal(state, event);
    case "IGNORE_GROUP":
    case "MARK_GROUP_IN_PROGRESS":
    case "MARK_GROUP_READY":
    case "MARK_GROUP_DONE":
    case "MARK_GROUP_ERROR":
      return updateGroupEvent(state, event);
  }
}

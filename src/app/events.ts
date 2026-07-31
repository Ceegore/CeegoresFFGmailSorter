import type { AppError } from "@/shared/errors";
import type { AnalysisResult, AppState } from "@/shared/types";

export type AppEvent =
  | { type: "TOGGLE_OVERLAY" }
  | { type: "SHOW_OVERLAY" }
  | { type: "START_ANALYSIS" }
  | { type: "ANALYSIS_SUCCEEDED"; result: AnalysisResult }
  | { type: "ANALYSIS_FAILED"; error: AppError }
  | { type: "SELECT_GROUP"; groupId: string }
  | { type: "CONFIRM_SEARCH" }
  | { type: "SEARCH_SUBMITTED"; query: string }
  | { type: "SEARCH_READY" }
  | { type: "SEARCH_READY_MANUAL" }
  | { type: "PAGE_SELECTED" }
  | { type: "ALL_SELECTED" }
  | { type: "MANUAL_SELECT_REQUIRED" }
  | { type: "MANUAL_SELECT_CONFIRMED" }
  | { type: "MOVE_MENU_OPENED" }
  | { type: "TARGET_CHOICE_DETECTED" }
  | { type: "COMPLETION_CONFIRMED" }
  | { type: "IGNORE_GROUP"; groupId: string }
  | { type: "MARK_GROUP_IN_PROGRESS"; groupId: string }
  | { type: "MARK_GROUP_READY"; groupId: string }
  | { type: "MARK_GROUP_DONE"; groupId: string }
  | { type: "MARK_GROUP_ERROR"; groupId: string; errorCode: string }
  | { type: "WORKFLOW_FAILED"; groupId: string; error: AppError }
  | { type: "FAIL"; error: AppError }
  | { type: "ROUTE_CONTEXT_INVALIDATED" }
  | { type: "CANCELLED" }
  | { type: "RETURN_TO_RESULTS" }
  | { type: "SET_FILTER"; value: string }
  | { type: "SET_SORT"; value: AppState["sort"] };

import { createStore, type Store } from "@/app/store";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";
import type { AppState } from "@/shared/types";
import type { AppEvent } from "@/app/events";

/**
 * Creates a store with the same acceptance snapshot used in production
 * (bootstrap.ts). This ensures tests see the same accepted/rejected behavior
 * as the real extension.
 */
export function createProductionStore(): Store<AppState, AppEvent> {
  return createStore(initialState, reduceAppState, (s) => [
    s.workflow,
    s.activeGroupId,
    s.error?.code ?? "",
    s.analysis !== null,
    s.overlayVisible,
    s.expectedQuery ?? "",
    s.filter,
    s.sort,
    s.analysis?.groups.map((g) => `${g.id}:${g.status}`).join(",") ?? "",
  ]);
}

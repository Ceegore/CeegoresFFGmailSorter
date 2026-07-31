export interface DispatchResult<S> {
  readonly accepted: boolean;
  readonly previous: S;
  readonly current: S;
}

export interface Store<S, E> {
  readonly getState: () => S;
  readonly dispatch: (event: E) => DispatchResult<S>;
  readonly subscribe: (listener: (state: S) => void) => () => void;
}

/**
 * Semantic snapshot of the state fields that determine whether a dispatch was
 * "accepted" (a real transition) vs. merely appending an illegal-transition
 * diagnostic. BUG-010: effects must only run when the transition was accepted.
 */
type AcceptanceKey = string;

function snapshotKey(fields: readonly unknown[]): AcceptanceKey {
  return fields.map((f) => String(f)).join("|");
}

export function createStore<S, E>(
  initial: S,
  reducer: (state: S, event: E) => S,
  /** Returns the fields whose change distinguishes acceptance from a diagnostic. */
  acceptance?: (state: S) => readonly unknown[],
): Store<S, E> {
  let state = initial;
  const listeners = new Set<(state: S) => void>();
  const keyOf = acceptance;

  return {
    getState: () => state,
    dispatch: (event) => {
      const previous = state;
      const next = reducer(state, event);
      // BUG-010: an event is "accepted" if state changed. When an acceptance
      // snapshot fn is provided, additionally require the snapshot to differ
      // (so an illegal-transition diagnostic append is NOT acceptance).
      const stateChanged = !Object.is(next, state);
      const accepted = keyOf
        ? stateChanged && snapshotKey(keyOf(next)) !== snapshotKey(keyOf(previous))
        : stateChanged;
      if (!Object.is(next, state)) {
        state = next;
        for (const listener of [...listeners]) {
          try {
            listener(state);
          } catch (error) {
            console.error("GISO store subscriber failed", error);
          }
        }
      }
      return { accepted, previous, current: state };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

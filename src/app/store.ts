export interface Store<S, E> {
  readonly getState: () => S;
  readonly dispatch: (event: E) => void;
  readonly subscribe: (listener: (state: S) => void) => () => void;
}

export function createStore<S, E>(initial: S, reducer: (state: S, event: E) => S): Store<S, E> {
  let state = initial;
  const listeners = new Set<(state: S) => void>();

  return {
    getState: () => state,
    dispatch: (event) => {
      const next = reducer(state, event);
      if (Object.is(next, state)) return;
      state = next;
      for (const listener of [...listeners]) {
        try {
          listener(state);
        } catch (error) {
          console.error("GISO store subscriber failed", error);
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

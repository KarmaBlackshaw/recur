import { useCallback, useState } from "react";

type Patch<S> = Partial<S> | null | ((prev: S) => Partial<S> | null);

// Object state whose setter merges a patch into the previous state, like class setState.
export function useSetState<S extends object>(initialState: S | (() => S)): [S, (patch: Patch<S>) => void] {
  const [state, setState] = useState(initialState);
  const setMergeState = useCallback((patch: Patch<S>) => {
    setState((prev) => {
      const next = typeof patch === "function" ? patch(prev) : patch;
      return next ? { ...prev, ...next } : prev;
    });
  }, []);
  return [state, setMergeState];
}

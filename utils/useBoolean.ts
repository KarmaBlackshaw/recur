import { useMemo, useState } from "react";

export interface BooleanActions {
  toggle: () => void;
  set: (value: boolean) => void;
  setTrue: () => void;
  setFalse: () => void;
}

// Boolean state with stable action callbacks (safe to pass to memoized children).
export function useBoolean(defaultValue = false): [boolean, BooleanActions] {
  const [state, setState] = useState(defaultValue);
  const actions = useMemo<BooleanActions>(
    () => ({
      toggle: () => setState((value) => !value),
      set: (value) => setState(!!value),
      setTrue: () => setState(true),
      setFalse: () => setState(false),
    }),
    []
  );
  return [state, actions];
}

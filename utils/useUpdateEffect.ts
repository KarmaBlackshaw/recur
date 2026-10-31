import { useEffect, useRef, type DependencyList, type EffectCallback } from "react";

// useEffect that skips the first render: `effect` runs only when `deps` change after mount.
export function useUpdateEffect(effect: EffectCallback, deps: DependencyList) {
  const isMounted = useRef(false);

  // Reset on unmount, so a remount (StrictMode, fast refresh) skips its first render too.
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    []
  );

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    return effect();
  }, deps);
}

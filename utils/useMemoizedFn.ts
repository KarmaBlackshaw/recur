import { useMemo, useRef } from "react";

// A function whose identity never changes but always calls the latest `fn`.
// Only for callbacks nobody lists as a dependency to track state — a dependent
// useMemo/useEffect would never re-run.
export function useMemoizedFn<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
  const fnRef = useRef(fn);
  fnRef.current = useMemo(() => fn, [fn]);
  const memoized = useRef<((...args: Args) => Result) | null>(null);
  if (!memoized.current) {
    memoized.current = (...args) => fnRef.current(...args);
  }
  return memoized.current;
}

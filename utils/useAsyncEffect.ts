import { useEffect } from "react";

// Wraps useEffect for async work that may complete after unmount.
// `active` is a getter — call it after each await to bail out if the component is gone.
export function useAsyncEffect(
  fn: (active: () => boolean) => Promise<void>,
  deps: unknown[]
) {
  useEffect(() => {
    let isActive = true;
    fn(() => isActive);
    return () => {
      isActive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

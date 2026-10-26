import { useEffect } from "react";

// Runs `fn` once after the first render. An async `fn` is fire-and-forget.
export function useMount(fn: () => void | Promise<void>) {
  useEffect(() => {
    fn();
  }, []);
}

import { type DependencyList, useEffect } from "react";

type AsyncEffect = () => Promise<void> | AsyncGenerator<void, void, void>;

function isAsyncGenerator(value: ReturnType<AsyncEffect>): value is AsyncGenerator<void, void, void> {
  return Symbol.asyncIterator in value;
}

// useEffect for async work. With an `async function*` effect every `yield` is a
// checkpoint: after unmount (or a deps change) the generator isn't resumed, so the
// code after a `yield` never runs against a stale screen.
export function useAsyncEffect(effect: AsyncEffect, deps: DependencyList) {
  useEffect(() => {
    const running = effect();
    let isCancelled = false;
    async function execute() {
      if (isAsyncGenerator(running)) {
        while (true) {
          const result = await running.next();
          if (result.done || isCancelled) {
            break;
          }
        }
      } else {
        await running;
      }
    }
    execute();
    return () => {
      isCancelled = true;
    };
  }, deps);
}

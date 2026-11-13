import type { ComponentProps } from "react";
import type { NavigationAction, NavigationState, Stack } from "expo-router";

function paramsKey(params: unknown) {
  const entries = params != null && typeof params === "object" ? Object.entries(params) : [];
  return JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function isPushOfTop(state: NavigationState, action: NavigationAction) {
  if (action.type !== "PUSH" || (action.target != null && action.target !== state.key)) {
    return false;
  }
  const top = state.routes[state.index];
  const { payload } = action;
  if (payload == null || !("name" in payload) || payload.name !== top.name) {
    return false;
  }
  return paramsKey("params" in payload ? payload.params : undefined) === paramsKey(top.params);
}

// router.push only queues the push, so a caller can't see the screen its first tap opened; the stack reducer can.
export const skipRepeatPush: NonNullable<ComponentProps<typeof Stack>["UNSTABLE_router"]> = (original) => ({
  getStateForAction(state, action, options) {
    if (isPushOfTop(state, action)) {
      return { state, affectedRouteKey: state.routes[state.index].key };
    }
    return original.getStateForAction(state, action, options);
  },
});

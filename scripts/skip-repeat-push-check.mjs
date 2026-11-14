import assert from "node:assert/strict";

const { skipRepeatPush } = await import("../utils/navigation/skipRepeatPush.ts");
const { equal } = assert;

const DELEGATED = { state: "delegated", affectedRouteKey: undefined };
const router = skipRepeatPush({ getStateForAction: () => DELEGATED });
const state = {
  key: "root",
  index: 2,
  routes: [
    { key: "tabs", name: "(tabs)" },
    { key: "bill", name: "expense/[id]", params: { id: "rent", year: "2026", month: "10" } },
    { key: "account", name: "account/[id]", params: { id: "bpi" } },
  ],
};
const reduce = (action) => router.getStateForAction(state, action, {});
const push = (name, params, extra = {}) => reduce({ type: "PUSH", payload: { name, params }, ...extra });

const skipped = push("account/[id]", { id: "bpi" });
equal(skipped.state, state);
equal(skipped.affectedRouteKey, "account");

equal(push("account/[id]", { id: "maribank" }), DELEGATED);
equal(push("account/edit", { id: "bpi" }), DELEGATED);
equal(push("expense/[id]", { id: "rent", year: "2026", month: "10" }), DELEGATED);
equal(push("account/[id]", { id: "bpi", action: "pay" }), DELEGATED);
equal(push("account/[id]", { id: "bpi" }, { target: "tabs-stack" }), DELEGATED);
equal(push("account/[id]", { id: "bpi" }, { target: "root" }).state, state);
equal(reduce({ type: "NAVIGATE", payload: { name: "account/[id]", params: { id: "bpi" } } }), DELEGATED);
equal(reduce({ type: "GO_BACK" }), DELEGATED);

const unordered = { ...state, routes: [state.routes[0], { key: "bill", name: "expense/[id]", params: { month: "10", id: "rent", year: "2026" } }], index: 1 };
equal(router.getStateForAction(unordered, { type: "PUSH", payload: { name: "expense/[id]", params: { id: "rent", year: "2026", month: "10" } } }, {}).state, unordered);

const bare = { ...state, routes: [state.routes[0], { key: "settings", name: "settings" }], index: 1 };
equal(router.getStateForAction(bare, { type: "PUSH", payload: { name: "settings" } }, {}).state, bare);
equal(router.getStateForAction(bare, { type: "PUSH", payload: { name: "settings", params: {} } }, {}).state, bare);

console.log("skip-repeat-push-check: ok");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QUICK_ADD_URL_PREFIX, WIDGET_QUICK_ACTIONS } from "../constants/quickActions.ts";

const kotlinPath = "plugins/withQuickAddWidget/android/QuickAddWidgetProvider.kt";
const kotlin = readFileSync(new URL(`../${kotlinPath}`, import.meta.url), "utf8");

const prefixMatch = kotlin.match(/const\s+val\s+URL_PREFIX\s*=\s*"([^"]*)"/);
assert.ok(prefixMatch, `${kotlinPath}: URL_PREFIX string literal not found`);
assert.equal(prefixMatch[1], QUICK_ADD_URL_PREFIX, `URL_PREFIX in ${kotlinPath} differs from QUICK_ADD_URL_PREFIX in constants/quickActions.ts`);

const buttonsMatch = kotlin.match(/val\s+BUTTONS\s*=\s*listOf\(([\s\S]*?)\n\s*\)/);
assert.ok(buttonsMatch, `${kotlinPath}: BUTTONS = listOf(...) block not found`);
const kotlinActions = [...buttonsMatch[1].matchAll(/\bto\s+"([^"]*)"/g)].map(([, action]) => action);
assert.ok(kotlinActions.length > 0, `${kotlinPath}: no "to <action>" pairs found in BUTTONS`);
assert.equal(new Set(kotlinActions).size, kotlinActions.length, `${kotlinPath}: BUTTONS lists an action twice (${kotlinActions.join(", ")})`);

assert.deepEqual(
  [...kotlinActions].sort(),
  [...WIDGET_QUICK_ACTIONS].sort(),
  `BUTTONS in ${kotlinPath} and WIDGET_QUICK_ACTIONS in constants/quickActions.ts list different actions`,
);

console.log("quick-actions-check: ok");

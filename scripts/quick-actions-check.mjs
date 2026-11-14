import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QUICK_ADD_URL_PREFIX, WIDGET_QUICK_ACTIONS } from "../constants/quickActions.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const moduleDir = "modules/quick-add-widget/android/src/main";
const kotlinPath = `${moduleDir}/java/com/erniejeash/recur/QuickAddWidgetProvider.kt`;
const kotlin = read(kotlinPath);

const { expo } = JSON.parse(read("app.json"));
assert.ok([expo.scheme].flat().includes("recur"), 'app.json "scheme" must include "recur"');

const manifest = read(`${moduleDir}/AndroidManifest.xml`);
assert.ok(
  manifest.includes('android:name="com.erniejeash.recur.QuickAddWidgetProvider"') && manifest.includes('android:resource="@xml/quick_add_widget_info"'),
  "quick-add-widget manifest must declare com.erniejeash.recur.QuickAddWidgetProvider with the quick_add_widget_info meta-data",
);
assert.ok(/^package com\.erniejeash\.recur$/m.test(kotlin), `${kotlinPath}: must keep package com.erniejeash.recur, the receiver name placed widgets are bound to`);

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

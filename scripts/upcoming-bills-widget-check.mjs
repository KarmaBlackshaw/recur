import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const read = (path) => readFileSync(new URL(path, root), "utf8");
const { equal, deepEqual, ok } = assert;

const moduleDir = "modules/upcoming-bills-widget/android/src/main";
const kotlinDir = `${moduleDir}/java/expo/modules/upcomingbillswidget`;
const contractPath = `${kotlinDir}/UpcomingBillsWidgetContract.kt`;
const contract = read(contractPath);
const kotlinConst = (name) => {
  const match = contract.match(new RegExp(`const\\s+val\\s+${name}\\s*=\\s*"([^"]*)"`));
  ok(match, `${contractPath}: ${name} string literal not found`);
  return match[1];
};

const { WIDGET_URL_PREFIX, WIDGET_HOME_LINK, billWidgetLink, cardWidgetLink, widgetLinkHref } = await import("../constants/widgetLinks.ts");

equal(kotlinConst("URL_PREFIX"), WIDGET_URL_PREFIX, "URL_PREFIX in the Kotlin contract differs from WIDGET_URL_PREFIX");
equal(kotlinConst("HOME_LINK"), WIDGET_HOME_LINK, "HOME_LINK in the Kotlin contract differs from WIDGET_HOME_LINK");
ok(WIDGET_URL_PREFIX.startsWith(`${JSON.parse(read("app.json")).expo.scheme}://`), "widget prefix must use the app scheme");

const moduleName = kotlinConst("MODULE_NAME");
ok(read("modules/upcoming-bills-widget/index.ts").includes(`"${moduleName}"`), `modules/upcoming-bills-widget/index.ts must require native module "${moduleName}"`);
ok(read("modules/upcoming-bills-widget/expo-module.config.json").includes("UpcomingBillsWidgetModule"), "expo-module.config.json must list UpcomingBillsWidgetModule");
ok(existsSync(new URL(`${kotlinDir}/UpcomingBillsWidgetModule.kt`, root)), "UpcomingBillsWidgetModule.kt missing");
ok(read(`${kotlinDir}/UpcomingBillsWidgetModule.kt`).includes("Name(UpcomingBillsWidgetContract.MODULE_NAME)"), "module must be named from the contract constant");
ok(read(`${kotlinDir}/UpcomingBillsWidgetModule.kt`).includes('AsyncFunction("setSnapshot")'), "module must expose setSnapshot");
ok(read("modules/upcoming-bills-widget/index.ts").includes("setSnapshot"), "index.ts must call setSnapshot");

const manifest = read(`${moduleDir}/AndroidManifest.xml`);
ok(manifest.includes("UpcomingBillsWidgetProvider") && manifest.includes("@xml/upcoming_bills_widget_info"), "manifest must declare the provider");
ok(/UpcomingBillsWidgetService[\s\S]*?BIND_REMOTEVIEWS/.test(manifest), "manifest must declare the service with BIND_REMOTEVIEWS");

const nativeIntent = read("app/+native-intent.tsx");
ok(nativeIntent.includes("WIDGET_URL_PREFIX") && nativeIntent.includes("widgetLinkHref"), "app/+native-intent.tsx must route widget links through widgetLinkHref");

equal(widgetLinkHref(WIDGET_HOME_LINK), "/");
equal(widgetLinkHref(billWidgetLink("e 1", 2026, 0)), "/expense/e%201?year=2026&month=0");
equal(widgetLinkHref(cardWidgetLink("acc/1")), "/account/acc%2F1");
for (const bad of ["recur://quick-add/x", "recur://widget/", "recur://widget/bill/x", "recur://widget/bill/x?year=2026", "recur://widget/card", "recur://widget/home/x", "recur://widget/other/x"]) {
  equal(widgetLinkHref(bad), null, `${bad} must not resolve`);
}

const { PRESET_CATEGORIES, categoryIcon } = await import("../utils/categories.ts");
const icons = new Set([...PRESET_CATEGORIES.map((category) => categoryIcon(category)), categoryIcon("Custom thing"), "credit-card", "tag"]);
const kotlinService = read(`${kotlinDir}/UpcomingBillsWidgetService.kt`);
for (const icon of icons) {
  const drawable = `upcoming_bills_widget_ic_${icon.replaceAll("-", "_")}`;
  ok(existsSync(new URL(`${moduleDir}/res/drawable/${drawable}.xml`, root)), `drawable ${drawable} missing for icon "${icon}"`);
  ok(kotlinService.includes(`"${icon}" -> R.drawable.${drawable}`) || icon === "tag", `Kotlin iconResource has no mapping for "${icon}"`);
}

const { buildUpcomingBillsSnapshot, SNAPSHOT_ROW_LIMIT } = await import("../utils/widget/upcomingBillsSnapshot.ts");
const date = (y, m, d) => new Date(y, m, d);
const expense = (id, due, extra = {}) => ({
  kind: "expense",
  key: `e-${id}`,
  expense: { id, name: "", notes: "", category: "Utilities", accountId: null, dueDay: due.getDate(), ...extra },
  effDate: due,
  refDate: due,
  amount: 100,
});
const cardBill = (id, due, bill = {}) => ({
  kind: "cardBill",
  key: `c-${id}`,
  bill: { account: { id, name: "Visa" }, paid: 0, remaining: 0, amount: 0, isPaid: false, isEstimate: false, ...bill },
  effDate: due,
  amount: 0,
});
const progress = { bill: 1000, paid: 0, left: 1000 };
const build = (overdue, upcoming, getBillProgress = () => progress) =>
  buildUpcomingBillsSnapshot({ overdue, upcoming, getBillProgress, accountNameOf: (id) => (id === "a1" ? "Savings" : undefined) });

const snapshot = build(
  [expense("o2", date(2026, 4, 5)), expense("o1", date(2026, 4, 2))],
  [expense("u2", date(2026, 4, 20)), cardBill("a1", date(2026, 4, 10), { isEstimate: true }), expense("u1", date(2026, 4, 9))],
);
equal(snapshot.v, 1);
deepEqual(snapshot.rows.map((row) => row.key), ["e-o1", "e-o2", "e-u1", "c-a1", "e-u2"], "overdue first, each by due date");
deepEqual(snapshot.rows[0], {
  key: "e-o1", kind: "expense", title: "Utilities", meta: "", amount: "₱1,000.00", paid: null, icon: "zap", due: "2026-05-02", tone: "neutral",
  link: billWidgetLink("o1", 2026, 4),
});
const card = snapshot.rows[3];
deepEqual([card.kind, card.icon, card.tone, card.title, card.amount, card.link], ["cardBill", "credit-card", "accent", "Visa bill", "TBD", cardWidgetLink("a1")]);

const part = build([], [expense("p", date(2026, 4, 9), { accountId: "a1", name: "Rent", category: "Housing" })], () => ({ bill: 1000, paid: 500, left: 500 })).rows[0];
deepEqual([part.title, part.meta, part.amount, part.paid], ["Rent", "Housing · Savings", "₱500.00", "₱500.00 paid"]);

const partialCard = build([], [cardBill("a1", date(2026, 4, 9), { amount: 900, paid: 300, remaining: 600, isEstimate: true })]).rows[0];
deepEqual([partialCard.amount, partialCard.meta], ["₱900.00", "Estimated · ₱600.00 left"]);

const many = Array.from({ length: SNAPSHOT_ROW_LIMIT + 10 }, (_, i) => expense(`m${i}`, date(2026, 5, 1 + (i % 28))));
equal(build([], many).rows.length, SNAPSHOT_ROW_LIMIT);
equal(JSON.stringify(build([], many)), JSON.stringify(build([], [...many].reverse())), "row order must not depend on input order");
equal(JSON.stringify(snapshot), JSON.stringify(JSON.parse(JSON.stringify(snapshot))), "snapshot must be plain JSON");

console.log("upcoming-bills-widget-check: ok");

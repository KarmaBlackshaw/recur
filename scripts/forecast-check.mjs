import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { projectLine } = await import("../utils/forecast/projectLine.ts");
const { forecastOutflows } = await import("../utils/forecast/forecastOutflows.ts");
const { buildForecast } = await import("../utils/forecast/buildForecast.ts");
const { cardBillsFor } = await import("../utils/accounts/cardBillsFor.ts");
const { addForecastColumns } = await import("../db/addForecastColumns.ts");
const { layoutLine } = await import("../utils/charts/layoutLine.ts");

const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = new Date(2026, 10, 20, 9, 30);

// projectLine: a day's bills leave by its end, an overdue one today, and nothing past the window counts.
const line = projectLine({
  accountId: "bdo",
  start: 1000,
  outflows: [
    { amount: 200.1, date: new Date(2026, 9, 1) },
    { amount: 900, date: new Date(2026, 10, 25) },
    { amount: 50, date: new Date(2026, 11, 30) },
  ],
  threshold: 100,
  today,
  days: 10,
});
assert.equal(line.values.length, 11, "today plus 10 days");
assert.equal(line.values[0], 799.9, "an overdue bill leaves today, rounded to centavos");
assert.equal(line.values[5], -100.1);
assert.equal(line.values[10], -100.1, "a bill past the window isn't counted");
assert.equal(line.lowest, -100.1);
assert.equal(ymd(line.lowestOn), "2026-11-25", "the first day it reaches its lowest");
assert.equal(ymd(line.belowOn), "2026-11-25", "the first day under the threshold");

const flat = projectLine({ accountId: null, start: 500, outflows: [], threshold: 0, today, days: 30 });
assert.equal(flat.lowest, 500);
assert.equal(ymd(flat.lowestOn), "2026-11-20", "with no bills the lowest point is today");
assert.equal(flat.belowOn, null);
assert.notEqual(projectLine({ accountId: null, start: 500, outflows: [], threshold: 600, today, days: 30 }).belowOn, null, "already under the threshold today");

// forecastOutflows / buildForecast over a debit account, Cash, and two cards.
const account = (over) => ({
  name: over.id,
  sortOrder: 0,
  interestRate: null,
  interestPeriod: null,
  taxRate: null,
  interestAccruedThrough: null,
  creditLimit: null,
  statementDay: null,
  dueDay: null,
  reminderDaysBefore: null,
  payBillFromAccountId: null,
  lowBalanceThreshold: null,
  color: null,
  icon: null,
  logoUri: null,
  bank: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});
const cash = account({ id: "cash", name: "Cash", type: "cash" });
const bdo = account({ id: "bdo", name: "BDO", type: "debit", lowBalanceThreshold: 2000 });
const bpi = account({ id: "bpi", name: "BPI Card", type: "credit", statementDay: 25, dueDay: 15, payBillFromAccountId: "bdo" });
const metro = account({ id: "metro", name: "Metro Card", type: "credit", statementDay: 25, dueDay: 15 });
const activeAccounts = [cash, bdo, bpi, metro];

const txn = (id, accountId, amount, at) => ({ id, accountId, amount, kind: "charge", createdAt: at.toISOString() });
const transactions = [
  txn("t1", "bpi", 3000, new Date(2026, 9, 10)),   // Nov bill (statement Oct 25), due Nov 15: overdue.
  txn("t2", "bpi", 500, new Date(2026, 10, 1)),    // Dec bill adds it.
  txn("t3", "metro", 1000, new Date(2026, 10, 5)), // Dec bill, no Pay bill from.
];
const getCardBills = (billOverrides) => (year, month) =>
  cardBillsFor({ accounts: activeAccounts, transactions, billOverrides, year, month, now: today });

const expense = (over) => ({
  category: "Other",
  recurrence: "monthly",
  status: "unpaid",
  isVariable: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  startYear: 2026,
  startMonth: 0,
  endYear: null,
  endMonth: null,
  ...over,
});
const expenses = [
  expense({ id: "rent", name: "Rent", amount: 10000, dueDay: 10, accountId: "bdo" }),
  expense({ id: "phone", name: "Phone", amount: 800, dueDay: 15, accountId: "bpi" }),
  expense({ id: "power", name: "Power", amount: null, isVariable: true, dueDay: 25, accountId: "bdo" }),
  expense({ id: "gift", name: "Gift", amount: 999, dueDay: 21, recurrence: "one-off", accountId: "bdo" }),
  expense({ id: "gym", name: "Gym", amount: 1500, dueDay: 5, accountId: "bdo", endYear: 2026, endMonth: 10 }),
];
// Everything before November is paid; so is November's gym.
const getMonthStatus = (id, year, month) =>
  year * 12 + month < 2026 * 12 + 10 || (id === "gym" && month === 10) ? "paid" : "unpaid";
const getBillProgress = (e, year, month) =>
  getMonthStatus(e.id, year, month) === "paid" ? { bill: e.amount, paid: e.amount, left: 0 } : { bill: e.amount, paid: 0, left: e.amount };

const base = { expenses, getMonthStatus, getBillProgress, getCardBills: getCardBills([]), activeAccounts, today };
const summary = (o) => `${ymd(o.date)} ${o.name} ${o.amount} ${o.accountId ?? "-"}${o.isOverdue ? " overdue" : ""}`;

const month = forecastOutflows({ ...base, days: 30 });
assert.deepEqual(month.outflows.map(summary), [
  "2026-11-20 BPI Card 3000 bdo overdue",
  "2026-11-20 Rent 10000 bdo overdue",
  "2026-12-10 Rent 10000 bdo",
  "2026-12-15 BPI Card 500 bdo",
  "2026-12-15 Metro Card 1000 -",
  "2026-12-15 Phone 800 bdo overdue",
]);
assert.equal(month.outflows.find((o) => o.name === "Phone").cardId, "bpi", "a card-paid bill goes through its card");
assert.equal(month.unknownCount, 1, "November's Power has no amount; December's is past the window");

const twoMonths = forecastOutflows({ ...base, days: 60 });
assert.deepEqual(
  twoMonths.outflows.filter((o) => ymd(o.date) > "2026-12-15").map(summary),
  ["2027-1-10 Rent 10000 bdo", "2027-1-15 Phone 800 bdo"],
  "December's Phone is charged Dec 15, after the Nov 25 statement, so it's on January's bill"
);
assert.equal(twoMonths.unknownCount, 2);

const overridden = forecastOutflows({
  ...base,
  getCardBills: getCardBills([{ accountId: "bpi", year: 2026, month: 11, amount: 4000 }]),
  days: 30,
});
assert.deepEqual(
  overridden.outflows.filter((o) => o.cardId === "bpi").map(summary),
  ["2026-11-20 BPI Card 3000 bdo overdue", "2026-12-15 BPI Card 1000 bdo"],
  "a bill whose amount is set already counts the charges, so Phone isn't added on top"
);

const archivedFrom = forecastOutflows({ ...base, activeAccounts: [cash, bdo, metro], days: 30 });
assert.equal(
  archivedFrom.outflows.find((o) => o.name === "Phone").accountId,
  "cash",
  "a bill whose card is archived pays from Cash"
);

const forecast = buildForecast({
  ...base,
  getBalance: (id) => ({ cash: 2000, bdo: 30000, bpi: -3500, metro: -1000 })[id],
  generalThreshold: 10000,
  days: 30,
});
assert.deepEqual(forecast.accounts.map((a) => a.account.id), ["cash", "bdo"], "cards get no line of their own");
const bdoLine = forecast.accounts[1];
assert.equal(bdoLine.threshold, 2000, "an account's own threshold wins");
assert.equal(bdoLine.values[0], 17000);
assert.equal(bdoLine.lowest, 5700);
assert.equal(ymd(bdoLine.lowestOn), "2026-12-15");
assert.equal(bdoLine.belowOn, null);
const cashLine = forecast.accounts[0];
assert.equal(cashLine.threshold, 10000, "no threshold of its own: the general one");
assert.equal(ymd(cashLine.belowOn), "2026-11-20");
assert.equal(forecast.total.start, 32000, "the total is the debit and cash balances");
assert.equal(forecast.total.lowest, 6700, "a card bill with no Pay bill from lowers the total only");
assert.equal(ymd(forecast.total.belowOn), "2026-12-10");

// addForecastColumns: an existing accounts table gains both columns, NULL on its rows, and running it again is a no-op.
const sqlite = new DatabaseSync(":memory:");
const db = { getAllAsync: async (sql) => sqlite.prepare(sql).all(), execAsync: async (sql) => sqlite.exec(sql) };
sqlite.exec("CREATE TABLE accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL)");
sqlite.exec("INSERT INTO accounts (id, name, type) VALUES ('bpi', 'BPI Card', 'credit')");
await addForecastColumns(db);
await addForecastColumns(db);
assert.deepEqual(
  { ...sqlite.prepare("SELECT pay_bill_from_account_id, low_balance_threshold FROM accounts").get() },
  { pay_bill_from_account_id: null, low_balance_threshold: null }
);
sqlite.close();

// layoutLine: a balance holds until the next day's value (steps), and the threshold widens the scale to stay in view.
const chart = layoutLine({ values: [100, 50, 50], width: 110, height: 60, inset: 5, reference: 0 });
assert.equal(chart.linePath, "M5,5H55V30H105V30", "each value holds until the next");
assert.equal(chart.referenceY, 55, "a threshold below every value still lands on the chart");
assert.equal(chart.areaPath, `${chart.linePath}V60H5Z`);
const level = layoutLine({ values: [80, 80], width: 110, height: 60, inset: 5 });
assert.deepEqual(level.points.map(({ y }) => y), [30, 30], "a flat line sits mid-chart");

console.log("forecast-check: ok");

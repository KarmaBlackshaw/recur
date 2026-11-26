import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DONUT_LABEL_HEIGHT, layoutDonut } from "../utils/charts/layoutDonut.ts";
import { categoryBreakdown } from "../utils/stats/categoryBreakdown.ts";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { categoryLine, categorySlice, categoryRows } = await import("../utils/activity/categoryLine.ts");
const { sumBy } = await import("../utils/collections.ts");
const { bucketFlows } = await import("../utils/stats/bucketFlows.ts");
const { bucketLabel } = await import("../utils/stats/bucketLabel.ts");
const { bucketTicks } = await import("../utils/stats/bucketTicks.ts");
const { layoutLine, lineSlotAt } = await import("../utils/charts/layoutLine.ts");
const { runningNet } = await import("../utils/stats/runningNet.ts");
const { netReadout, signedNet } = await import("../utils/stats/netReadout.ts");
const { netFlow } = await import("../utils/activity/netFlow.ts");
const { loanFlow } = await import("../utils/activity/loanFlow.ts");
const { matchesActivity } = await import("../utils/activitySearch.ts");

const line = (category, amount, icon = "tag") => ({ category, icon, amount });
const names = (rows) => rows.map((r) => r.category).join(",");

assert.deepEqual(categoryBreakdown([]), []);

const rows = categoryBreakdown([line("Food", 100, "coffee"), line("Housing", 600), line("Food", 200), line("Transport", 100)]);
assert.equal(names(rows), "Housing,Food,Transport", "biggest first, same category merged");
assert.deepEqual(rows[1], { category: "Food", icon: "coffee", amount: 300, count: 2, share: 0.3 }, "a slice keeps its first line's icon");
assert.ok(Math.abs(rows.reduce((sum, r) => sum + r.share, 0) - 1) < 1e-9, "shares add up to the whole");

assert.equal(names(categoryBreakdown([line("Zoo", 50), line("Art", 50)])), "Art,Zoo", "ties break by name");

const skipped = categoryBreakdown([line("Food", 100), line("Variable", 0), line("Refund", -20)]);
assert.equal(names(skipped), "Food", "no slice for zero or negative lines");
assert.equal(skipped[0].share, 1, "skipped lines don't dilute the share");

const layout = (values) => layoutDonut({ values, width: 360, radius: 80, thickness: 24 });
const labelsOn = (slices, side) =>
  slices.filter((slice) => slice.isLabelled && slice.side === side).map((slice) => slice.labelY).sort((a, b) => a - b);

for (const values of [
  [33.9, 13.6, 13.4, 10.9, 5.4, 3.3, 19.5],
  [59, 16, 8, 7, 3, 2, 5],
  [90, 2, 2, 2, 2, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
]) {
  const { slices, height } = layout(values);
  assert.equal(slices.length, values.length);
  for (const side of ["left", "right"]) {
    const ys = labelsOn(slices, side);
    ys.forEach((y, index) => {
      assert.ok(y >= DONUT_LABEL_HEIGHT / 2 && y <= height - DONUT_LABEL_HEIGHT / 2, `label inside the chart: ${values}`);
      if (index > 0) {
        assert.ok(y - ys[index - 1] >= DONUT_LABEL_HEIGHT - 1e-9, `labels don't touch: ${values}`);
      }
    });
  }
}

const biggestFirst = layout([59, 16, 8, 7, 3, 2, 5]).slices;
assert.equal(biggestFirst[0].side, "right", "a slice past 180° still labels on its midpoint's side");
assert.equal(biggestFirst[1].side, "left");
assert.ok(biggestFirst[0].arcPath.includes(" 0 1 1 "), "over 180° uses the large arc");
assert.ok(biggestFirst[1].arcPath.includes(" 0 0 1 "), "under 180° doesn't");
assert.equal(layout([100]).slices[0].arcPath.match(/A /g).length, 2, "a full ring is two arcs: one arc can't close");
assert.ok(layout([100]).slices[0].isLabelled, "a single slice keeps its label");

const tinyTail = layout([50000, 12000, 1500, 300, 200, 80]).slices.map((slice) => slice.isLabelled);
assert.deepEqual(tinyTail, [true, true, true, false, false, false], "slices under 2% get no label or line, so they can't bundle at the top");

const paid = (category, amount) => ({ kind: "expense", expense: { category }, amount });
const billPayment = (fee) => ({ kind: "billPayment", payment: {}, amount: 5000, fee });
const transfer = (fee, earned, earnedCategory = null) => ({ kind: "transfer", transfer: {}, amount: 2000, fee, earned, earnedCategory });
const income = (category, amount, loan) => ({ kind: "income", income: { category }, loan, amount });
const interest = (amount) => ({ kind: "interest", interest: {}, amount, tax: 1 });
const loanTxn = { kind: "loan", loanTxn: { kind: "loan_out" }, amount: 900 };
const slice = (entry, flow) => {
  const result = categoryLine(entry, flow);
  return result && `${result.category} ${result.amount}`;
};

assert.equal(slice(paid("Food", 120), "expenses"), "Food 120");
assert.equal(slice(paid("Food", 120), "income"), null);
assert.equal(slice(paid("Food", 0), "expenses"), null, "a ₱0 payment adds no row, as it adds no slice");
assert.equal(slice(billPayment(15), "expenses"), "Fees 15", "a bill payment adds only its fee");
assert.equal(slice(billPayment(0), "expenses"), null);
assert.equal(slice(transfer(10, 50), "expenses"), "Fees 10", "a transfer adds its fee, not the amount moved");
assert.equal(slice(transfer(0, 50), "income"), "Other 50", "income on a transfer with no category is Other");
assert.equal(slice(transfer(0, 50, "Transfer"), "income"), "Transfer 50");
assert.equal(slice(transfer(0, 0), "income"), null);
assert.equal(slice(income("Salary", 1000), "income"), "Salary 1000");
assert.equal(slice(income(null, 30), "income"), "Other 30");
assert.equal(slice(income("Overpayment", 80, { id: "l1" }), "income"), "Overpayment from loans 80");
assert.equal(
  categoryLine(income("Salary", 80, { id: "l1" }), "income").icon,
  categoryLine(income("Salary", 1000), "income").icon,
  "a loan's income keeps its category's icon"
);
assert.equal(slice(income("Salary", 1000), "expenses"), null);
assert.equal(slice(interest(5), "income"), "Interest 5");
assert.equal(slice(interest(0), "income"), null, "interest all withheld as tax adds nothing");
assert.equal(slice(loanTxn, "expenses"), null, "lent money is still yours");
assert.equal(slice(loanTxn, "income"), null, "a repayment isn't income");

// Activity's category filter lists the rows whose line lands in the slice, so its count and total match the slice.
const feed = [paid("Food", 100), paid("Food", 0), transfer(10, 0), billPayment(5), paid("Housing", 600), loanTxn, income("Salary", 900)];
const slices = categoryBreakdown(feed.flatMap((entry) => categoryLine(entry, "expenses") ?? []));
for (const { category, count, amount } of slices) {
  const { entries, total } = categorySlice(feed, "expenses", category);
  assert.equal(entries.length, count, `${category}: same count`);
  assert.equal(total, amount, `${category}: same total`);
}
assert.deepEqual(categorySlice(feed, "expenses", "Fees").entries, [feed[2], feed[3]], "a fee slice lists the transfer and bill payment");
assert.equal(categorySlice(feed, "expenses", "Fees").total, 15, "and adds only their fees");
assert.equal(names(slices), "Housing,Food,Fees");

const repayment = (excess, principal = 1000) => ({
  kind: "repayment",
  key: "repayment:r1",
  repayment: {
    id: "r1",
    borrower: "Ana",
    principal,
    accountIds: ["a1"],
    payments: [
      { txn: { amount: 600 }, loan: undefined, isSettling: true },
      { txn: { amount: 400 }, loan: undefined, isSettling: false },
    ],
  },
  excess,
  amount: principal + (excess?.amount ?? 0),
});
const excessRow = income("Overpayment", 200, { id: "l1" });
const withExcess = repayment(excessRow);
const withoutExcess = repayment(undefined);

assert.equal(netFlow(withExcess), 200, "a repayment adds the excess its folded income row used to");
assert.equal(netFlow(withoutExcess), 0, "a repayment with no excess adds nothing");
assert.equal(netFlow(income("Salary", 900)), 900, "an income row still adds its amount");

assert.equal(loanFlow(withExcess), 1000, "a repayment's day total is its principal, excess left out");
assert.equal(loanFlow(withoutExcess), 1000);
assert.equal(loanFlow(loanTxn), -900, "lent money is negative");
assert.equal(loanFlow(paid("Food", 50)), 0, "other rows add nothing");

assert.equal(slice(withExcess, "income"), "Overpayment from loans 200", "a repayment carries its excess's income line");
assert.deepEqual(categoryLine(withExcess, "income"), categoryLine(excessRow, "income"));
assert.equal(slice(withoutExcess, "income"), null);
assert.equal(slice(withExcess, "expenses"), null);
const overpaid = [withExcess, income("Overpayment", 50, { id: "l2" })];
assert.equal(categorySlice(overpaid, "income", "Overpayment from loans").total, 250, "the slice sums the repayment's excess and a plain income row");
assert.equal(categorySlice(overpaid, "income", "Overpayment from loans").entries.length, 2);

const ctx = { accountName: (id) => (id === "a1" ? "GCash" : undefined) };
for (const query of ["Ana repaid", "loan", "repaid", "gcash", "600.00", "400", "1200", "1,200.00", "overpayment"]) {
  assert.ok(matchesActivity(withExcess, query, ctx), `a repayment matches "${query}"`);
}
assert.ok(!matchesActivity(withExcess, "Bob", ctx), "an unrelated name doesn't match");
const noBorrower = { ...withoutExcess, repayment: { ...withoutExcess.repayment, borrower: undefined } };
assert.ok(matchesActivity(noBorrower, "loan", ctx), "a borrower-less repayment still matches loan");
assert.ok(!matchesActivity(noBorrower, "repaid", ctx), "and has no borrower to be called repaid");

const lent = { kind: "loan", loanTxn: { accountId: "a1", note: null }, loan: { borrower: "Ana", note: "Tuition" }, amount: 900 };
assert.ok(matchesActivity(lent, "tuition", ctx), "a loan matches its note");
const billPaid = { kind: "billPayment", payment: { note: "October statement" }, account: { name: "BPI Card" }, sourceName: "GCash", amount: 5000 };
assert.ok(matchesActivity(billPaid, "october", ctx), "a bill payment matches its note");
const named = { kind: "expense", expense: { name: "", notes: "Meralco", category: "Utilities", accountId: "a1" }, amount: 1200 };
assert.ok(matchesActivity(named, "meralco", ctx), "an expense matches its notes, which are its title");

const { parseMonth, parseStatsView, parseYear } = await import("../constants/periods.ts");
const thisYear = new Date().getFullYear();
const thisMonth = new Date().getMonth();
assert.equal(parseYear("2025"), 2025);
assert.equal(parseMonth("0"), 0);
assert.equal(parseMonth("11"), 11);
for (const bad of [undefined, "", "abc", "999", "10000"]) {
  assert.equal(parseYear(bad), thisYear, `year ${bad} falls back to this year`);
}
for (const bad of [undefined, "", "xyz", "-1", "12"]) {
  assert.equal(parseMonth(bad), thisMonth, `month ${bad} falls back to this month`);
}
assert.equal(parseStatsView("trend"), "trend");
assert.equal(parseStatsView("bar"), "trend", "an old bar-view link opens the Net so far line");
for (const other of [undefined, "", "donut", "pie"]) {
  assert.equal(parseStatsView(other), "donut", `view ${other} falls back to the donut`);
}

const on = (entry, y, m, d, h = 12, min = 0) => ({ ...entry, effDate: new Date(y, m, d, h, min) });
const october = [
  on(paid("Food", 100), 2026, 9, 2, 10),
  on(paid("Rent", 600), 2026, 9, 4),
  on(income("Salary", 900), 2026, 9, 4),
  on(loanTxn, 2026, 9, 5),
  on(transfer(10, 50), 2026, 9, 31, 23, 59),
];
const octDays = bucketFlows({ entries: october, year: 2026, month: 9, period: "month" });
assert.equal(octDays.length, 31);
assert.equal(octDays[0].key, "2026-10-01");
assert.deepEqual([octDays[3].income, octDays[3].expenses], [900, 600]);
assert.deepEqual([octDays[4].income, octDays[4].expenses], [0, 0], "a loan adds nothing");
assert.deepEqual([octDays[30].income, octDays[30].expenses], [50, 10], "23:59 on the last day lands on the last day");
assert.equal(sumBy(octDays, "expenses"), sumBy(categoryRows(october, "expenses"), "amount"), "days add up to the Expenses tab");
assert.equal(sumBy(octDays, "income"), sumBy(categoryRows(october, "income"), "amount"), "days add up to the Income tab");
assert.equal(bucketFlows({ entries: [], year: 2026, month: 1, period: "month" }).length, 28, "February 2026");
const yearMonths = bucketFlows({ entries: october, year: 2026, month: 0, period: "year" });
assert.equal(yearMonths.length, 12);
assert.deepEqual(yearMonths.map((b) => b.key).slice(8, 11), ["2026-09", "2026-10", "2026-11"]);
assert.equal(yearMonths[9].income, 950);
assert.equal(yearMonths[9].expenses, 710);

assert.equal(bucketLabel(octDays[1], "month"), "Fri, Oct 2");
assert.equal(bucketLabel(yearMonths[9], "year"), "October");
assert.deepEqual(bucketTicks(octDays, "month").filter(Boolean), ["1", "8", "15", "22", "29"]);
assert.deepEqual(bucketTicks(yearMonths, "year"), ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]);

const soFar = runningNet(octDays, new Date(2026, 9, 4, 8));
assert.deepEqual(soFar.map((p) => p.net), [0, -100, -100, 200], "the net runs from the 1st and stops at today");
assert.deepEqual([soFar[3].income, soFar[3].expenses], [900, 700], "income and expenses are running totals too");
assert.equal(soFar[3].key, "2026-10-04");
const wholeMonth = runningNet(octDays, new Date(2026, 10, 1));
assert.equal(wholeMonth.length, 31, "a past month runs to its last day");
assert.equal(wholeMonth.at(-1).net, 240);
assert.equal(wholeMonth.at(-1).net, sumBy(categoryRows(october, "income"), "amount") - sumBy(categoryRows(october, "expenses"), "amount"), "the end of the line is the period's net");
assert.deepEqual(runningNet(octDays, new Date(2026, 8, 30)), [], "a month that hasn't started has no line");
const fractions = runningNet(
  bucketFlows({ entries: [on(paid("Food", 0.1), 2026, 9, 1), on(paid("Food", 0.2), 2026, 9, 1)], year: 2026, month: 9, period: "month" }),
  new Date(2026, 9, 1, 13),
);
assert.equal(fractions[0].net, -0.3, "centavos don't drift");
const yearSoFar = runningNet(yearMonths, new Date(2026, 9, 15));
assert.equal(yearSoFar.length, 10, "a year runs to this month");
assert.equal(yearSoFar.at(-1).net, 240);

assert.equal(netReadout(soFar[1], "month"), "By Oct 2 · behind ₱100.00");
assert.equal(netReadout(soFar[3], "month"), "By Oct 4 · ahead ₱200.00");
assert.equal(netReadout(soFar[0], "month"), "By Oct 1 · even");
assert.equal(netReadout(yearSoFar.at(-1), "year"), "By October · ahead ₱240.00");
assert.equal(signedNet(240), "+₱240.00");
assert.equal(signedNet(-100), "−₱100.00");
assert.equal(signedNet(0), "₱0.00");

const crossing = layoutLine({ values: [100, -100], slots: 3, width: 100, height: 100, inset: 0 });
assert.deepEqual(crossing.slotXs, [0, 50, 100], "slots span the width, past the last value");
assert.equal(crossing.linePath, "M0,0L50,100");
assert.equal(crossing.baselineY, 50);
assert.equal(crossing.abovePath, "M0,50L0,0L25,50L50,50L50,50Z", "the area above zero stops where the line crosses it");
assert.equal(crossing.belowPath, "M0,50L0,50L25,50L50,100L50,50Z", "and the area below starts there");
assert.deepEqual(crossing.gridlines.map((g) => g.value), [-100, -50, 0, 50, 100]);
const above = layoutLine({ values: [10, 30], slots: 2, width: 100, height: 100, inset: 0 });
const pathYs = (path) => [...path.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
assert.ok(pathYs(above.belowPath).every((y) => y === above.baselineY), "a line above zero has no area below it");
assert.equal(above.gridlines[0].value, 0, "zero stays on the chart");
const flat = layoutLine({ values: [0, 0], slots: 2, width: 100, height: 100, inset: 0 });
assert.ok(!`${flat.linePath}${flat.abovePath}${flat.belowPath}${flat.baselineY}`.includes("NaN"), "all-zero: no NaN");
const empty = layoutLine({ values: [], slots: 31, width: 100, height: 100, inset: 0 });
assert.deepEqual([empty.linePath, empty.abovePath, empty.belowPath], ["", "", ""]);
assert.equal(layoutLine({ values: [50], slots: 31, width: 100, height: 100, inset: 0 }).abovePath, "", "one point has no area");
assert.equal(lineSlotAt(30, 3, 100, 0), 1);
assert.equal(lineSlotAt(-20, 3, 100, 0), 0);
assert.equal(lineSlotAt(500, 3, 100, 0), 2);
assert.equal(lineSlotAt(30, 1, 100, 0), 0);

console.log("stats-check ok");

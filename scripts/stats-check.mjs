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
const { categoryLine, categorySlice } = await import("../utils/activity/categoryLine.ts");
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

console.log("stats-check ok");

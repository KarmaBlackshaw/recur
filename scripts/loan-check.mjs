import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { summarizeLoan } from "../utils/loans/summarizeLoan.ts";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { maxPaymentOn } = await import("../utils/loans/maxPaymentOn.ts");
const { splitLoanPayment } = await import("../utils/loans/splitLoanPayment.ts");

const lentAt = "2026-10-05";
const loan = (interest, principal = 500, lentOn = lentAt) => ({ principal, lentAt: lentOn, interest });
const pay = (amount, createdAt) => ({ amount, createdAt });
const monthly = loan({ type: "monthly_balance", rate: 2 });
const T = "2026-12-05";
const cents = (n) => Math.round(n * 100);
const sumCents = (values) => values.reduce((sum, n) => sum + cents(n), 0);
const targetsOn = (loans, paidAt) =>
  loans.map((l) => ({ loan: l, payments: [], cap: maxPaymentOn({ loan: l, payments: [], paidAt, today: T }) }));

const none = summarizeLoan({ loan: loan({ type: "none" }), payments: [], today: "2026-12-01" });
assert.equal(none.balance, 500);
const noneSettled = summarizeLoan({ loan: loan({ type: "none" }), payments: [pay(500, lentAt)], today: lentAt });
assert.equal(noneSettled.balance, 0);
assert.equal(noneSettled.isSettled, true);
assert.equal(noneSettled.settledAt, lentAt);

const fixed = summarizeLoan({ loan: loan({ type: "fixed", amount: 10 }), payments: [], today: lentAt });
assert.equal(fixed.balance, 510);
const fixedSettled = summarizeLoan({ loan: loan({ type: "fixed", amount: 10 }), payments: [pay(510, lentAt)], today: lentAt });
assert.equal(fixedSettled.balance, 0);
assert.equal(fixedSettled.isSettled, true);
assert.equal(fixedSettled.isValid, true);

assert.equal(summarizeLoan({ loan: loan({ type: "percent_once", rate: 2 }), payments: [], today: lentAt }).balance, 510);

const byPrincipal = summarizeLoan({ loan: loan({ type: "monthly_principal", rate: 2 }), payments: [], today: "2027-01-05" });
assert.equal(byPrincipal.charges.length, 3);
assert.equal(byPrincipal.balance, 530);
assert.equal(byPrincipal.interestTotal, 30);

const worked = summarizeLoan({ loan: monthly, payments: [pay(200, "2026-11-20")], today: "2026-12-05" });
assert.deepEqual(worked.charges, [{ date: "2026-11-05", amount: 10 }, { date: "2026-12-05", amount: 6.2 }]);
assert.equal(worked.balance, 316.2);
assert.equal(worked.paidTotal, 200);
assert.equal(worked.interestTotal, 16.2);

const compounding = summarizeLoan({ loan: monthly, payments: [], today: "2027-01-05" });
assert.deepEqual(compounding.charges.map(({ amount }) => amount), [10, 10.2, 10.4]);
assert.equal(compounding.balance, 530.6);

const sameDay = summarizeLoan({ loan: monthly, payments: [pay(100, "2026-11-05")], today: "2026-11-05" });
assert.deepEqual(sameDay.charges, [{ date: "2026-11-05", amount: 10 }]);
assert.equal(sameDay.balance, 410);

const anniversaryPayoff = summarizeLoan({ loan: monthly, payments: [pay(510, "2026-11-05")], today: "2026-12-10" });
assert.equal(anniversaryPayoff.isSettled, true);
assert.equal(anniversaryPayoff.settledAt, "2026-11-05");
assert.deepEqual(anniversaryPayoff.charges, [{ date: "2026-11-05", amount: 10 }]);
assert.equal(anniversaryPayoff.balance, 0);

const backdated = summarizeLoan({ loan: monthly, payments: [pay(500, "2026-10-20"), pay(50, "2026-12-01")], today: "2026-12-10" });
assert.equal(backdated.balance, -50);
assert.equal(backdated.isValid, false);

const beforeLent = summarizeLoan({ loan: loan({ type: "none" }), payments: [pay(100, "2026-10-04")], today: lentAt });
assert.equal(beforeLent.balance, 400);
assert.equal(beforeLent.isValid, false);

const clamp = summarizeLoan({ loan: { principal: 500, lentAt: "2026-01-31", interest: { type: "monthly_principal", rate: 2 } }, payments: [], today: "2026-04-01" });
assert.deepEqual(clamp.charges.map(({ date }) => date), ["2026-02-28", "2026-03-31"]);

const float = summarizeLoan({ loan: loan({ type: "none" }, 0.3), payments: [pay(0.1, lentAt), pay(0.2, "2026-10-06")], today: "2026-10-06" });
assert.equal(float.balance, 0);
assert.equal(float.isSettled, true);
assert.equal(float.paidTotal, 0.3);

const later = summarizeLoan({ loan: monthly, payments: [pay(510, "2026-11-05")], today: "2027-06-01" });
assert.equal(later.charges.length, anniversaryPayoff.charges.length);

const interests = [
  { type: "none" },
  { type: "fixed", amount: 10 },
  { type: "percent_once", rate: 2 },
  { type: "monthly_principal", rate: 2 },
  { type: "monthly_balance", rate: 2 },
];
const capsToday = interests.map((interest) => maxPaymentOn({ loan: loan(interest), payments: [], paidAt: T, today: T }));
assert.deepEqual(capsToday, [500, 510, 510, 520, 520.2]);
assert.deepEqual(capsToday, interests.map((interest) => summarizeLoan({ loan: loan(interest), payments: [], today: T }).balance));

const existing = pay(100, "2026-10-20");
assert.equal(maxPaymentOn({ loan: monthly, payments: [existing], paidAt: T, today: T }), 416.16);
assert.equal(summarizeLoan({ loan: monthly, payments: [existing], today: T }).balance, 416.16);

assert.equal(maxPaymentOn({ loan: monthly, payments: [], paidAt: "2026-11-01", today: T }), 500);
assert.equal(maxPaymentOn({ loan: monthly, payments: [], paidAt: "2026-10-04", today: T }), 0);

const oldestFirst = targetsOn([loan({ type: "none" }, 500, "2026-10-01"), loan({ type: "none" }, 300), loan({ type: "none" }, 200, "2026-10-10")], T);
const partial = splitLoanPayment({ amount: 120, targets: oldestFirst, paidAt: T, today: T });
assert.deepEqual(partial.parts.map(({ share }) => share), [120, 0, 0]);
assert.deepEqual(partial.parts.map(({ balanceAfter }) => balanceAfter), [380, 300, 200]);
assert.equal(partial.total, 1000);
assert.equal(partial.unplaced, 0);

const spill = splitLoanPayment({ amount: 650, targets: oldestFirst, paidAt: T, today: T });
assert.deepEqual(spill.parts.map(({ share }) => share), [500, 150, 0]);
assert.deepEqual(spill.parts.map(({ isSettled }) => isSettled), [true, false, false]);
assert.deepEqual(spill.parts.map(({ balanceAfter }) => balanceAfter), [0, 150, 200]);

for (const interest of interests) {
  const targets = targetsOn([loan(interest)], T);
  const full = splitLoanPayment({ amount: targets[0].cap, targets, paidAt: T, today: T });
  assert.equal(full.parts[0].isSettled, true);
  assert.equal(full.parts[0].balanceAfter, 0);
  assert.equal(full.unplaced, 0);
}

const everyType = targetsOn(interests.map((interest, i) => loan(interest, 500, `2026-10-0${i + 1}`)), T);
const everyTotal = sumCents(everyType.map(({ cap }) => cap)) / 100;
const settleAll = splitLoanPayment({ amount: everyTotal, targets: everyType, paidAt: T, today: T });
assert.equal(settleAll.total, 2560.2);
assert.equal(settleAll.parts.every(({ isSettled }) => isSettled), true);
assert.equal(sumCents(settleAll.parts.map(({ share }) => share)), cents(2560.2));

const lentLater = targetsOn(
  [loan({ type: "none" }, 500, "2026-10-01"), monthly, loan({ type: "monthly_principal", rate: 2 }, 500, "2026-11-10")],
  "2026-11-01",
);
assert.deepEqual(lentLater.map(({ cap }) => cap), [500, 500, 0]);
const beforeLentSplit = splitLoanPayment({ amount: 1000, targets: lentLater, paidAt: "2026-11-01", today: T });
assert.deepEqual(beforeLentSplit.parts.map(({ share }) => share), [500, 500, 0]);
assert.deepEqual(beforeLentSplit.parts.map(({ isSettled }) => isSettled), [true, true, false]);
assert.equal(beforeLentSplit.parts[2].balanceAfter, 500);
assert.equal(beforeLentSplit.unplaced, 0);

const over = splitLoanPayment({ amount: 2560.21, targets: everyType, paidAt: T, today: T });
assert.equal(over.unplaced, 0.01);
assert.deepEqual(over.parts.map(({ share }) => share), everyType.map(({ cap }) => cap));

const backdatedSplit = splitLoanPayment({ amount: 200, targets: targetsOn([monthly], "2026-10-20"), paidAt: "2026-10-20", today: T });
assert.equal(backdatedSplit.parts[0].balanceAfter, 312.12);
assert.equal(cents(backdatedSplit.parts[0].balanceAfter) < cents(520.2) - cents(200), true);
assert.equal(backdatedSplit.parts[0].balanceAfter, summarizeLoan({ loan: monthly, payments: [pay(200, "2026-10-20")], today: T }).balance);

const backdatedPrincipal = splitLoanPayment({
  amount: 123.45,
  targets: targetsOn([loan({ type: "monthly_principal", rate: 2 })], "2026-10-20"),
  paidAt: "2026-10-20",
  today: T,
});
assert.equal(backdatedPrincipal.parts[0].balanceAfter, 396.55);

const tiny = splitLoanPayment({ amount: 0.3, targets: targetsOn([loan({ type: "none" }, 0.1), loan({ type: "none" }, 0.2)], T), paidAt: T, today: T });
assert.deepEqual(tiny.parts.map(({ share }) => share), [0.1, 0.2]);
assert.equal(sumCents(tiny.parts.map(({ share }) => share)), 30);
assert.equal(tiny.unplaced, 0);

const large = splitLoanPayment({
  amount: 6000.29,
  targets: targetsOn([loan({ type: "none" }, 5150.17, "2026-10-01"), loan({ type: "none" }, 2000)], T),
  paidAt: T,
  today: T,
});
assert.deepEqual(large.parts.map(({ share }) => share), [5150.17, 850.12]);
assert.deepEqual(large.parts.map(({ balanceAfter }) => balanceAfter), [0, 1149.88]);
assert.equal(large.total, 7150.17);

for (const amount of [NaN, 0, -5]) {
  const nothing = splitLoanPayment({ amount, targets: oldestFirst, paidAt: T, today: T });
  assert.deepEqual(nothing.parts.map(({ share }) => share), [0, 0, 0]);
  assert.equal(nothing.unplaced, 0);
}

const reversed = oldestFirst.toReversed();
const inGivenOrder = splitLoanPayment({ amount: 120, targets: reversed, paidAt: T, today: T });
assert.equal(inGivenOrder.parts.length, reversed.length);
for (const [i, target] of reversed.entries()) {
  assert.equal(inGivenOrder.parts[i].loan, target.loan);
}

const iso = new Date("2026-12-05T00:00:00").toISOString();
const isoTargets = targetsOn([loan({ type: "none" })], iso);
assert.equal(isoTargets[0].cap, 500);
const isoSplit = splitLoanPayment({ amount: 500, targets: isoTargets, paidAt: iso, today: T });
assert.equal(isoSplit.parts[0].isSettled, true);

const carried = [
  { loan: monthly, payments: [existing], cap: maxPaymentOn({ loan: monthly, payments: [existing], paidAt: T, today: T }) },
  ...targetsOn([loan({ type: "none" }, 300, "2026-10-10")], T),
];
assert.deepEqual(carried.map(({ cap }) => cap), [416.16, 300]);
const carriedFull = splitLoanPayment({ amount: sumCents(carried.map(({ cap }) => cap)) / 100, targets: carried, paidAt: T, today: T });
assert.equal(carriedFull.total, 716.16);
assert.deepEqual(carriedFull.parts.map(({ share }) => share), [416.16, 300]);
assert.deepEqual(carriedFull.parts.map(({ isSettled }) => isSettled), [true, true]);
assert.deepEqual(carriedFull.parts.map(({ balanceAfter }) => balanceAfter), [0, 0]);
assert.equal(carriedFull.unplaced, 0);

const carriedPartial = splitLoanPayment({ amount: 200, targets: carried, paidAt: T, today: T });
assert.deepEqual(carriedPartial.parts.map(({ share }) => share), [200, 0]);
assert.deepEqual(carriedPartial.parts.map(({ balanceAfter }) => balanceAfter), [216.16, 300]);
assert.deepEqual(carriedPartial.parts.map(({ isSettled }) => isSettled), [false, false]);
assert.equal(carriedPartial.unplaced, 0);
assert.equal(carriedPartial.parts[0].balanceAfter, summarizeLoan({ loan: monthly, payments: [existing, pay(200, T)], today: T }).balance);

console.log("loan-check: all passed");

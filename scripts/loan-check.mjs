import assert from "node:assert/strict";
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
const { summarizeLoan } = await import("../utils/loans/summarizeLoan.ts");
const { maxPaymentOn } = await import("../utils/loans/maxPaymentOn.ts");
const { splitLoanPayment } = await import("../utils/loans/splitLoanPayment.ts");
const { canChangeLoan } = await import("../utils/loans/canChangeLoan.ts");
const { canEditPayment } = await import("../utils/loans/canEditPayment.ts");
const { groupRepayments } = await import("../utils/loans/groupRepayments.ts");
const { repaymentLabels } = await import("../utils/loans/repaymentLabels.ts");

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

const late = pay(50, "2026-12-01");
const backdated = summarizeLoan({ loan: monthly, payments: [pay(500, "2026-10-20"), late], today: "2026-12-10" });
assert.equal(backdated.balance, 0);
assert.equal(backdated.isValid, true);
assert.equal(backdated.isSettled, true);
assert.equal(backdated.settledAt, "2026-10-20");
assert.deepEqual(backdated.charges, []);
assert.deepEqual(backdated.overpayments, [{ payment: late, amount: 50 }]);
assert.equal(backdated.overpaid, 50);

const second = pay(300, "2026-10-07");
const crossing = summarizeLoan({ loan: loan({ type: "none" }), payments: [second, pay(300, "2026-10-06")], today: T });
assert.equal(crossing.balance, 0);
assert.equal(crossing.paidTotal, 600);
assert.deepEqual(crossing.overpayments, [{ payment: second, amount: 100 }]);
assert.equal(crossing.overpaid, 100);

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
assert.equal(maxPaymentOn({ loan: monthly, payments: [pay(510, "2026-11-05")], paidAt: T, today: T }), 0);

// A Pay in full backdated before a later-dated payment settles the loan, and that later payment is flagged.
const byPrincipal5 = loan({ type: "monthly_principal", rate: 5 }, 1000, "2026-08-01");
const later20 = pay(20, "2026-10-10");
const backdatedCap = maxPaymentOn({ loan: byPrincipal5, payments: [later20], paidAt: "2026-09-15", today: "2026-11-01" });
assert.equal(backdatedCap, 1050);
const backdatedFull = summarizeLoan({ loan: byPrincipal5, payments: [later20, pay(backdatedCap, "2026-09-15")], today: "2026-11-01" });
assert.equal(backdatedFull.isSettled, true);
assert.equal(backdatedFull.settledAt, "2026-09-15");
assert.deepEqual(backdatedFull.overpayments, [{ payment: later20, amount: 20 }]);
const shortOfCap = summarizeLoan({ loan: byPrincipal5, payments: [later20, pay(1049.99, "2026-09-15")], today: "2026-11-01" });
assert.equal(shortOfCap.isSettled, false);

// When no amount lands on ₱0, the least that settles leaves the later payment a cent over.
const later13 = pay(13, "2026-12-01");
const roundedCap = maxPaymentOn({ loan: monthly, payments: [later13], paidAt: "2026-10-20", today: T });
assert.equal(roundedCap, 487.26);
const rounded = summarizeLoan({ loan: monthly, payments: [later13, pay(roundedCap, "2026-10-20")], today: T });
assert.equal(rounded.isSettled, true);
assert.deepEqual(rounded.overpayments, [{ payment: later13, amount: 0.01 }]);
assert.equal(summarizeLoan({ loan: monthly, payments: [later13, pay(487.25, "2026-10-20")], today: T }).isSettled, false);

const overpaying = [pay(300, "2026-10-06"), pay(300, "2026-10-07")];
const termsFor = (principal, lentOn = lentAt) => loan({ type: "none" }, principal, lentOn);
const change = (next) =>
  canChangeLoan({ current: { loan: termsFor(500), payments: overpaying }, next: { loan: next, payments: overpaying }, today: T });
assert.equal(change(termsFor(500)), true);
assert.equal(change(termsFor(550)), true);
assert.equal(change(termsFor(450)), false);
assert.equal(change(termsFor(500, "2026-10-06")), true);
assert.equal(change(termsFor(500, "2026-10-07")), false);

const backdatedPayoff = { id: "payoff", ...pay(1050, "2026-09-15") };
const flagged = { id: "flagged", ...later20 };
const edit = (id, next) =>
  canEditPayment({ loan: byPrincipal5, payments: [backdatedPayoff, flagged], id, next, today: "2026-11-01" });
assert.equal(edit("flagged", pay(20, "2026-10-10")), true);
assert.equal(edit("flagged", pay(15, "2026-10-20")), true);
assert.equal(edit("flagged", pay(20.01, "2026-10-10")), false);
assert.equal(edit("payoff", pay(1050, "2026-09-15")), true);
assert.equal(edit("payoff", pay(1050.01, "2026-09-15")), false);
assert.equal(edit("payoff", pay(500, "2026-09-15")), true);

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

const unsettled = summarizeLoan({ loan: loan({ type: "none" }), payments: [pay(200, "2026-10-06")], today: T });
assert.equal(unsettled.settledBy, null);
const first = pay(200, "2026-10-06");
const settler = pay(300, "2026-10-07");
const twoStep = summarizeLoan({ loan: loan({ type: "none" }), payments: [first, settler], today: T });
assert.equal(twoStep.settledBy, settler);
const overFirst = pay(400, "2026-10-06");
const overSecond = pay(200, "2026-10-07");
const overpaidTwo = summarizeLoan({ loan: loan({ type: "none" }), payments: [overFirst, overSecond], today: T });
assert.equal(overpaidTwo.settledBy, overSecond);
assert.equal(overpaidTwo.overpaid, 100);
const tieA = pay(300, "2026-11-20T09:00:00.000Z");
const tieB = pay(300, "2026-11-20T10:00:00.000Z");
const tied = summarizeLoan({ loan: monthly, payments: [tieA, tieB], today: "2026-12-04" });
assert.equal(tied.isSettled, true);
assert.equal(tied.settledBy, tieB);
const tiedReversed = summarizeLoan({ loan: monthly, payments: [tieB, tieA], today: "2026-12-04" });
assert.equal(tiedReversed.settledBy, tieB);
assert.equal(tiedReversed.balance, tied.balance);
assert.equal(tiedReversed.interestTotal, tied.interestTotal);
const lateFirst = pay(200, "2026-11-20T10:00:00.000Z");
const earlyAfter = pay(300, "2026-11-20T09:00:00.000Z");
const sameDayOrder = summarizeLoan({ loan: loan({ type: "none" }), payments: [lateFirst, earlyAfter], today: T });
assert.equal(sameDayOrder.isSettled, true);
assert.equal(sameDayOrder.settledBy, lateFirst);
assert.equal(sameDayOrder.settledAt, "2026-11-20");
assert.equal(
  summarizeLoan({ loan: monthly, payments: [pay(100, "2026-10-20")], today: "2026-10-25" }).settledBy,
  null
);

const txn = (id, over = {}) => ({
  id,
  accountId: "a1",
  kind: "loan_in",
  amount: 100,
  expenseId: null,
  cycleYear: null,
  cycleMonth: null,
  transferId: null,
  note: null,
  category: null,
  loanId: "L1",
  reversesId: null,
  repaymentId: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  ...over,
});
const loanRow = (id, over = {}) => ({
  id,
  borrower: "Ana",
  principal: 500,
  accountId: "a1",
  lentAt: "2026-10-01",
  interest: { type: "none" },
  note: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  revertedAt: null,
  ...over,
});
const L1 = loanRow("L1");
const L2 = loanRow("L2", { lentAt: "2026-09-01" });
const group = (transactions, loans = [L1, L2], summaries = {}) => groupRepayments({ transactions, loans, summaries });

const pA = txn("p1", { repaymentId: "R1", loanId: "L1", amount: 100, createdAt: "2026-11-01T10:00:00.000Z" });
const pB = txn("p2", { repaymentId: "R1", loanId: "L2", amount: 200, accountId: "a2", createdAt: "2026-11-01T10:00:01.000Z" });
const extra = txn("e1", { kind: "income", repaymentId: "R1", loanId: "L1", amount: 50, accountId: "a3", createdAt: "2026-11-01T10:00:02.000Z" });
const [shared] = group([pA, pB, extra]);
assert.equal(group([pA, pB, extra]).length, 1);
assert.equal(shared.id, "R1");
assert.equal(shared.principal, 300);
assert.equal(shared.total, 350);
assert.equal(shared.excess, extra);
assert.equal(shared.borrower, "Ana");
assert.deepEqual(shared.payments.map(({ txn: t }) => t.id), ["p2", "p1"]);
assert.deepEqual(shared.accountIds, ["a2", "a1", "a3"]);
assert.equal(shared.paidAt, pB.createdAt);

const legacy = txn("old", { repaymentId: null, amount: 75 });
const [legacyRepayment] = group([legacy]);
assert.equal(legacyRepayment.id, "old");
assert.equal(legacyRepayment.excess, undefined);
assert.equal(legacyRepayment.total, 75);

const [pennies] = group([
  txn("t1", { repaymentId: "R2", amount: 0.1 }),
  txn("t2", { repaymentId: "R2", amount: 0.2 }),
  txn("t3", { kind: "income", repaymentId: "R2", loanId: "L1", amount: 0.01 }),
]);
assert.equal(pennies.principal, 0.3);
assert.equal(pennies.total, 0.31);

assert.deepEqual(group([]), []);
assert.deepEqual(group([txn("x1", { kind: "income", repaymentId: "R3", loanId: "L1", amount: 50 })]), []);
const orphaned = group([
  txn("x2", { kind: "income", repaymentId: "R4", loanId: "L1", amount: 20 }),
  txn("x3", { repaymentId: "R5", amount: 10 }),
]);
assert.deepEqual(orphaned.map(({ id }) => id), ["R5"], "a group whose only live row is its excess income is omitted");
assert.equal(orphaned[0].excess, undefined);
assert.deepEqual(
  group([txn("x2", { kind: "income", repaymentId: null, loanId: "L1" }), txn("x3", { kind: "payment", loanId: "L1" })]),
  []
);
assert.equal(group([txn("x4", { kind: "income", repaymentId: "R4", loanId: "L1", transferId: "tr" }), txn("x5", { repaymentId: "R4" })])[0].excess, undefined);

const partialGroup = group([txn("q1", { repaymentId: "R5", amount: 40 }), txn("q2", { repaymentId: "R5", amount: 60 })]);
assert.equal(partialGroup[0].principal, 100);
assert.equal(partialGroup[0].payments.length, 2);

const settling = (payment) => ({ settledBy: payment });
const s1 = txn("s1", { repaymentId: "R6", loanId: "L1" });
const s2 = txn("s2", { repaymentId: "R6", loanId: "L2" });
assert.equal(group([s1, s2], [L1, L2], { L1: settling(null), L2: settling(null) })[0].settledCount, 0);
assert.equal(group([s1, s2], [L1, L2], { L1: settling(s1), L2: settling(null) })[0].settledCount, 1);
const nSettled = group([s1, s2], [L1, L2], { L1: settling(s1), L2: settling(s2) })[0];
assert.equal(nSettled.settledCount, 2);
assert.deepEqual(nSettled.payments.map(({ isSettling }) => isSettling), [true, true]);
assert.equal(group([s1], [L1], {})[0].settledCount, 0);

const older = txn("n1", { createdAt: "2026-11-01T08:00:00.000Z" });
const newer = txn("n2", { createdAt: "2026-11-02T08:00:00.000Z" });
assert.deepEqual(group([older, newer]).map(({ id }) => id), ["n2", "n1"]);
const tieOne = txn("m1");
const tieTwo = txn("m2");
assert.deepEqual(group([tieOne, tieTwo]).map(({ id }) => id), ["m2", "m1"]);

const noLoan = group([txn("z1", { loanId: "gone" })])[0];
assert.equal(noLoan.borrower, undefined);
assert.equal(noLoan.payments[0].loan, undefined);
assert.equal(noLoan.payments[0].isSettling, false);
const orphanLast = group([
  txn("o1", { repaymentId: "R7", loanId: "gone", createdAt: "2026-11-01T09:00:00.000Z" }),
  txn("o2", { repaymentId: "R7", loanId: "L1", createdAt: "2026-11-01T10:00:00.000Z" }),
])[0];
assert.deepEqual(orphanLast.payments.map(({ txn: t }) => t.id), ["o2", "o1"]);

const names = { a1: "Cash", a2: "Bank" };
const accountName = (id) => names[id];
const labelsFor = (transactions, summaries = {}) => repaymentLabels(group(transactions, [L1, L2], summaries)[0], accountName);
const three = [
  txn("l1", { repaymentId: "R8", loanId: "L1" }),
  txn("l2", { repaymentId: "R8", loanId: "L2" }),
  txn("l3", { repaymentId: "R8", loanId: "L1" }),
];
const threeLabels = labelsFor(three, { L1: settling(three[0]), L2: settling(three[1]) });
assert.equal(threeLabels.loans, "3 loans");
assert.equal(threeLabels.settled, "2 settled");
assert.equal(threeLabels.settledLead, "2 settled");
assert.equal(threeLabels.account, "Cash");
const singleSettled = labelsFor([txn("l4")], { L1: settling(txn("l4")) });
assert.equal(singleSettled.loans, "1 loan");
assert.equal(singleSettled.settled, "settled");
assert.equal(singleSettled.settledLead, "Settled");
const noneSettledLabels = labelsFor(three);
assert.equal(noneSettledLabels.settled, null);
assert.equal(noneSettledLabels.settledLead, null);
assert.equal(labelsFor([txn("l5", { repaymentId: "R9" }), txn("l6", { repaymentId: "R9", accountId: "a2" })]).account, "2 accounts");
assert.equal(labelsFor([txn("l7", { accountId: "gone" })]).account, "Deleted account");
assert.equal(labelsFor([txn("l8")]).extra, null);
assert.equal(
  labelsFor([txn("l9", { repaymentId: "R10" }), txn("l10", { kind: "income", repaymentId: "R10", loanId: "L1", amount: 50 })]).extra,
  "+₱50.00 extra"
);

const { deleteLoanMessage } = await import("../utils/loans/deleteLoanMessage.ts");
const { revertLoanMessage } = await import("../utils/loans/revertLoanMessage.ts");
const { loanEntriesLabel } = await import("../utils/loans/loanEntriesLabel.ts");
const { revertRepaymentMessage } = await import("../utils/loans/revertRepaymentMessage.ts");

const withAcc = loanRow("M1");
const noAcc = loanRow("M2", { accountId: null });
const msgArgs = (loan, paymentCount, incomeCount, accountName) => ({ loan, paymentCount, incomeCount, accountName });
assert.equal(
  deleteLoanMessage(msgArgs(withAcc, 3, 1)),
  "This loan and its 3 payments and 1 income entry are removed, and account balances go back."
);
assert.equal(
  revertLoanMessage(msgArgs(withAcc, 3, 1)),
  "Account balances go back. This loan and its 3 payments and 1 income entry stay in the account history, marked as reverted."
);
assert.equal(deleteLoanMessage(msgArgs(withAcc, 1, 0)), "This loan and its 1 payment are removed, and account balances go back.");
assert.equal(
  revertLoanMessage(msgArgs(withAcc, 1, 0)),
  "Account balances go back. This loan and its 1 payment stay in the account history, marked as reverted."
);
assert.equal(deleteLoanMessage(msgArgs(withAcc, 0, 2)), "This loan and its 2 income entries are removed, and account balances go back.");
assert.equal(
  revertLoanMessage(msgArgs(withAcc, 0, 2)),
  "Account balances go back. This loan and its 2 income entries stay in the account history, marked as reverted."
);
assert.equal(deleteLoanMessage(msgArgs(noAcc, 0, 0)), "This loan is removed and no account balance changes.");
assert.equal(revertLoanMessage(msgArgs(noAcc, 0, 0)), "This loan is reverted and no account balance changes.");
assert.equal(deleteLoanMessage(msgArgs(withAcc, 0, 0, "BPI")), "This loan is removed and the money goes back to BPI.");
assert.equal(
  revertLoanMessage(msgArgs(withAcc, 0, 0, "BPI")),
  "The money goes back to BPI. The loan stays in the account history, marked as reverted."
);
assert.equal(deleteLoanMessage(msgArgs(withAcc, 0, 0)), "This loan is removed and the money goes back to its account.");
assert.equal(
  revertLoanMessage(msgArgs(withAcc, 0, 0)),
  "The money goes back to its account. The loan stays in the account history, marked as reverted."
);

assert.equal(loanEntriesLabel({ paymentCount: 3, incomeCount: 1 }), "3 payments and 1 income entry");
assert.equal(loanEntriesLabel({ paymentCount: 1, incomeCount: 0 }), "1 payment");
assert.equal(loanEntriesLabel({ paymentCount: 0, incomeCount: 2 }), "2 income entries");
assert.equal(loanEntriesLabel({ paymentCount: 0, incomeCount: 0 }), null);

const repaymentOf = (transactions) => group(transactions)[0];
const manyRepayment = repaymentOf([
  txn("r1", { repaymentId: "RV1", amount: 1000 }),
  txn("r2", { repaymentId: "RV1", amount: 500 }),
  txn("r3", { repaymentId: "RV1", amount: 300 }),
  txn("r4", { kind: "income", repaymentId: "RV1", loanId: "L1", amount: 200 }),
]);
const manyMessage = revertRepaymentMessage({
  repayment: manyRepayment,
  borrower: "Ate Isay",
  accountLabel: "BPI",
  owesAgain: 1800,
});
assert.equal(manyMessage.title, "Revert Ate Isay's ₱2,000.00 repayment?");
assert.equal(
  manyMessage.message,
  "₱2,000.00 leaves BPI and Ate Isay owes ₱1,800.00 again. The 3 payments and 1 income entry stay in the account history, marked as reverted."
);
const singleRepayment = repaymentOf([txn("r5", { repaymentId: "RV2", amount: 250 })]);
const singleMessage = revertRepaymentMessage({
  repayment: singleRepayment,
  borrower: "Ana",
  accountLabel: "its account",
  owesAgain: undefined,
});
assert.equal(singleMessage.title, "Revert Ana's ₱250.00 repayment?");
assert.equal(
  singleMessage.message,
  "₱250.00 leaves its account and Ana owes it again. The payment stays in the account history, marked as reverted."
);
const excessRepayment = repaymentOf([
  txn("r6", { repaymentId: "RV3", amount: 100 }),
  txn("r7", { kind: "income", repaymentId: "RV3", loanId: "L1", amount: 50 }),
]);
assert.equal(
  revertRepaymentMessage({ repayment: excessRepayment, borrower: "Ana", accountLabel: "2 accounts", owesAgain: 100 }).message,
  "₱150.00 leaves 2 accounts and Ana owes ₱100.00 again. The 1 payment and 1 income entry stay in the account history, marked as reverted."
);
const twoRepayment = repaymentOf([
  txn("r8", { repaymentId: "RV4", amount: 100 }),
  txn("r9", { repaymentId: "RV4", amount: 100, loanId: "L2" }),
]);
assert.equal(
  revertRepaymentMessage({ repayment: twoRepayment, borrower: "Ana", accountLabel: "BPI", owesAgain: undefined }).message,
  "₱200.00 leaves BPI and Ana owes it again. The 2 payments stay in the account history, marked as reverted."
);

console.log("loan-check: all passed");

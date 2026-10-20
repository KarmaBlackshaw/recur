import assert from "node:assert/strict";
import { summarizeLoan } from "../utils/loans/summarizeLoan.ts";

const lentAt = "2026-10-05";
const loan = (interest, principal = 500) => ({ principal, lentAt, interest });
const pay = (amount, createdAt) => ({ amount, createdAt });
const monthly = loan({ type: "monthly_balance", rate: 2 });

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

console.log("loan-check: all passed");

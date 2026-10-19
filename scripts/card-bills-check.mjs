import assert from "node:assert/strict";
import { billDates, computeBill, unsettledDebitIds } from "../utils/cardBills.ts";

const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const nov = billDates(25, 15, 2026, 10);
assert.equal(ymd(nov.cutoff), "2026-10-25");
assert.equal(ymd(nov.dueDate), "2026-11-15");

const early = billDates(5, 25, 2026, 10);
assert.equal(ymd(early.cutoff), "2026-11-5");
assert.equal(ymd(early.dueDate), "2026-11-25");

assert.equal(ymd(billDates(31, 15, 2026, 2).cutoff), "2026-2-28");
assert.equal(ymd(billDates(31, 15, 2028, 2).cutoff), "2028-2-29");
assert.equal(ymd(billDates(5, 31, 2028, 1).dueDate), "2028-2-29");
assert.equal(ymd(billDates(31, 31, 2026, 1).cutoff), "2026-1-31");
assert.equal(ymd(billDates(25, 15, 2026, 0).cutoff), "2025-12-25");

const base = { statementDay: 25, dueDay: 15, year: 2026, month: 10, override: undefined, now: new Date(2026, 10, 20) };

const onCutoff = computeBill({
  ...base,
  txns: [
    { id: "a", amount: 1000, createdAt: new Date(2026, 9, 25, 23, 30).toISOString() },
    { id: "b", amount: 500, createdAt: new Date(2026, 9, 26, 0, 30).toISOString() },
  ],
});
assert.equal(onCutoff.estimate, 1000);
assert.equal(onCutoff.amount, 1000);
assert.equal(onCutoff.isEstimate, true);
assert.equal(onCutoff.isPaid, false);
assert.equal(onCutoff.remaining, 1000);

const overridden = computeBill({ ...base, override: 1250.5, txns: [{ id: "a", amount: 1000, createdAt: new Date(2026, 9, 1).toISOString() }] });
assert.equal(overridden.amount, 1250.5);
assert.equal(overridden.estimate, 1000);
assert.equal(overridden.isEstimate, false);

const charge = { id: "c", amount: 3000, createdAt: new Date(2026, 9, 10).toISOString() };
const beforeCutoffPay = computeBill({ ...base, txns: [charge, { id: "p", amount: -1000, createdAt: new Date(2026, 9, 20).toISOString() }] });
assert.equal(beforeCutoffPay.estimate, 2000);
assert.equal(beforeCutoffPay.paid, 0);
assert.equal(beforeCutoffPay.remaining, 2000);

const partial = computeBill({ ...base, txns: [charge, { id: "p", amount: -1000, createdAt: new Date(2026, 10, 1).toISOString() }] });
assert.equal(partial.estimate, 3000);
assert.equal(partial.paid, 1000);
assert.equal(partial.remaining, 2000);
assert.equal(partial.isPaid, false);

const full = computeBill({ ...base, txns: [charge, { id: "p", amount: -2999.996, createdAt: new Date(2026, 10, 1).toISOString() }] });
assert.equal(full.isPaid, true);
assert.equal(full.remaining, 0);

const futurePay = computeBill({ ...base, now: new Date(2026, 10, 1), txns: [charge, { id: "p", amount: -3000, createdAt: new Date(2026, 10, 5).toISOString() }] });
assert.equal(futurePay.paid, 0);

const zero = computeBill({ ...base, txns: [] });
assert.equal(zero.amount, 0);
assert.equal(zero.isPaid, true);

const febEdge = billDates(30, 31, 2026, 1);
assert.equal(ymd(febEdge.cutoff), "2026-2-28");
assert.equal(ymd(febEdge.dueDate), "2026-2-28");
const janEdge = billDates(30, 31, 2026, 0);
assert.equal(ymd(janEdge.cutoff), "2026-1-30");
assert.notEqual(ymd(febEdge.cutoff), ymd(janEdge.cutoff));
const febLeap = billDates(28, 29, 2026, 1);
const janLeap = billDates(28, 29, 2026, 0);
assert.equal(ymd(febLeap.cutoff), "2026-2-28");
assert.equal(ymd(janLeap.cutoff), "2026-1-28");
assert.notEqual(ymd(febLeap.cutoff), ymd(janLeap.cutoff));

const latePayment = { id: "p", amount: -3000, createdAt: new Date(2026, 10, 28).toISOString() };
const late = computeBill({ ...base, now: new Date(2026, 11, 1), txns: [charge, latePayment] });
assert.equal(late.isPaid, true);
assert.equal(late.paid, 3000);
assert.equal(late.remaining, 0);

const capped = computeBill({
  ...base,
  now: new Date(2026, 11, 2),
  txns: [charge, latePayment, { id: "q", amount: -500, createdAt: new Date(2026, 11, 1).toISOString() }],
});
assert.equal(capped.paid, 3000);

const debits = [
  { id: "d2", amount: 200, createdAt: "2026-10-02T00:00:00.000Z" },
  { id: "d1", amount: 100, createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "d3", amount: 300, createdAt: "2026-10-02T00:00:00.000Z" },
];
assert.deepEqual([...unsettledDebitIds(debits)].sort(), ["d1", "d2", "d3"]);
assert.deepEqual([...unsettledDebitIds([...debits, { id: "k", amount: -150, createdAt: "2026-10-05T00:00:00.000Z" }])].sort(), ["d2", "d3"]);
assert.deepEqual([...unsettledDebitIds([...debits, { id: "k", amount: -299.996, createdAt: "2026-10-05T00:00:00.000Z" }])].sort(), ["d3"]);
assert.equal(unsettledDebitIds([...debits, { id: "k", amount: -1000, createdAt: "2026-10-05T00:00:00.000Z" }]).size, 0);

console.log("card-bills-check: ok");

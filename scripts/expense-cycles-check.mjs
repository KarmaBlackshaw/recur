import assert from "node:assert/strict";
import { cycleStateOn, hasCycleIn, inferStartMonth, nextCycleDueDate } from "../utils/dateHelpers.ts";

const ymd = (d) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

const monthly = { recurrence: "monthly", startYear: 2026, startMonth: 3, endYear: 2026, endMonth: 8, dueDay: 31 };
assert.equal(cycleStateOn(monthly, 2026, 2), "not-started");
assert.equal(cycleStateOn(monthly, 2026, 3), "active");
assert.equal(cycleStateOn(monthly, 2026, 8), "active");
assert.equal(cycleStateOn(monthly, 2026, 9), "ended");
assert.equal(cycleStateOn(monthly, 2025, 11), "not-started");
assert.equal(hasCycleIn(monthly, 2026, 5), true);
assert.equal(hasCycleIn(monthly, 2026, 9), false);

// Legacy rows with no start month have no lower bound.
const openEnded = { recurrence: "monthly", startYear: null, startMonth: null, endYear: null, endMonth: null, dueDay: 5 };
assert.equal(cycleStateOn(openEnded, 1999, 0), "active");

// Yearly: due only in the start month's calendar month, every year from the start on.
const yearly = { recurrence: "yearly", startYear: 2026, startMonth: 2, endYear: null, endMonth: null, dueDay: 10 };
assert.equal(cycleStateOn(yearly, 2025, 2), "not-started");
assert.equal(cycleStateOn(yearly, 2026, 2), "active");
assert.equal(cycleStateOn(yearly, 2026, 9), "off-cycle");
assert.equal(cycleStateOn(yearly, 2027, 2), "active");
assert.equal(hasCycleIn(yearly, 2027, 3), false);

// One-offs are always "active" for the state, but never count as a recurring cycle.
const oneOff = { recurrence: "one-off", startYear: null, startMonth: null, endYear: null, endMonth: null, dueDay: 1 };
assert.equal(cycleStateOn(oneOff, 2026, 0), "active");
assert.equal(hasCycleIn(oneOff, 2026, 0), false);

// Next due date from a viewed month.
assert.equal(ymd(nextCycleDueDate(yearly, 2026, 9)), "2027-3-10");
assert.equal(ymd(nextCycleDueDate(yearly, 2026, 2)), "2026-3-10");
assert.equal(ymd(nextCycleDueDate(yearly, 2025, 6)), "2026-3-10");
assert.equal(ymd(nextCycleDueDate(monthly, 2026, 1)), "2026-4-30");
assert.equal(ymd(nextCycleDueDate(monthly, 2026, 4)), "2026-5-31");
assert.equal(nextCycleDueDate(monthly, 2026, 9), null);
const febYearly = { ...yearly, startMonth: 1, dueDay: 31 };
assert.equal(ymd(nextCycleDueDate(febYearly, 2027, 5)), "2028-2-29");

// Start months recovered from history (createdAt mid-month so the local month is unambiguous).
const created = "2026-06-15T04:00:00.000Z";
assert.deepEqual(inferStartMonth({ recurrence: "monthly", createdAt: created, months: [] }), { year: 2026, month: 5 });
assert.deepEqual(
  inferStartMonth({
    recurrence: "monthly",
    createdAt: created,
    months: [
      { year: 2026, month: 4, status: "unpaid" },
      { year: 2026, month: 2, status: "paid" },
      { year: 2026, month: 7, status: "paid" },
    ],
  }),
  { year: 2026, month: 2 }
);
assert.deepEqual(
  inferStartMonth({
    recurrence: "yearly",
    createdAt: created,
    months: [
      { year: 2026, month: 1, status: "unpaid" },
      { year: 2026, month: 8, status: "paid" },
      { year: 2027, month: 8, status: "paid" },
    ],
  }),
  { year: 2026, month: 8 }
);
assert.deepEqual(
  inferStartMonth({ recurrence: "yearly", createdAt: created, months: [{ year: 2026, month: 3, status: "unpaid" }] }),
  { year: 2026, month: 3 }
);

console.log("expense-cycles-check: ok");

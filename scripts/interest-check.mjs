import assert from "node:assert/strict";
import { accrueInterest, netInterestPerPeriod, periodEnds } from "../utils/interest.ts";

const round2 = (n) => Math.round(n * 100) / 100;

const daily = accrueInterest({
  rate: 4,
  period: "daily",
  taxRate: 20,
  from: "2026-01-01",
  today: "2026-02-01",
  balanceAt: () => 10000,
});
assert.equal(periodEnds("2026-01-01", "2026-02-01", "daily").length, 30);
assert.equal(daily.gross, 32.92);
assert.equal(round2(daily.gross - daily.tax), 26.33);
assert.equal(daily.through, "2026-01-31");

assert.equal(
  accrueInterest({ rate: 4, period: "daily", taxRate: 20, from: "2026-01-31", today: "2026-02-01", balanceAt: () => 10000 }),
  null,
);

const negative = accrueInterest({
  rate: 4,
  period: "daily",
  taxRate: 20,
  from: "2026-01-01",
  today: "2026-02-01",
  balanceAt: () => -500,
});
assert.equal(negative.gross, 0);

assert.deepEqual(periodEnds("2026-01-15", "2026-04-02", "monthly"), ["2026-01-31", "2026-02-28", "2026-03-31"]);

const prorated = accrueInterest({ rate: 12, period: "monthly", taxRate: 0, from: "2026-01-15", today: "2026-02-02", balanceAt: () => 10000 });
assert.equal(prorated.gross, round2((10000 * 0.12 * 16) / 365));
assert.equal(prorated.gross, 52.6);

const fullMonth = accrueInterest({ rate: 12, period: "monthly", taxRate: 0, from: "2025-12-31", today: "2026-02-01", balanceAt: () => 10000 });
assert.equal(fullMonth.gross, 100);

assert.equal(round2(netInterestPerPeriod(10000, 4, 20, "daily")), 0.88);
assert.equal(round2(netInterestPerPeriod(10000, 4, 20, "monthly")), 26.67);
assert.equal(round2(netInterestPerPeriod(10000, 4, 20, "yearly")), 320);
assert.equal(netInterestPerPeriod(-500, 4, 20, "daily"), 0);

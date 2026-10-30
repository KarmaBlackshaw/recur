import assert from "node:assert/strict";
import { categoryBreakdown } from "../utils/stats/categoryBreakdown.ts";

const line = (category, amount) => ({ category, amount });
const names = (rows) => rows.map((r) => r.category).join(",");

assert.deepEqual(categoryBreakdown([]), []);

const rows = categoryBreakdown([line("Food", 100), line("Housing", 600), line("Food", 200), line("Transport", 100)]);
assert.equal(names(rows), "Housing,Food,Transport", "biggest first, same category merged");
assert.deepEqual(rows[1], { category: "Food", amount: 300, count: 2, share: 0.3 });
assert.ok(Math.abs(rows.reduce((sum, r) => sum + r.share, 0) - 1) < 1e-9, "shares add up to the whole");

assert.equal(names(categoryBreakdown([line("Zoo", 50), line("Art", 50)])), "Art,Zoo", "ties break by name");

const skipped = categoryBreakdown([line("Food", 100), line("Variable", 0), line("Refund", -20)]);
assert.equal(names(skipped), "Food", "no slice for zero or negative lines");
assert.equal(skipped[0].share, 1, "skipped lines don't dilute the share");

console.log("stats-check ok");

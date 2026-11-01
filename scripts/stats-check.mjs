import assert from "node:assert/strict";
import { DONUT_LABEL_HEIGHT, layoutDonut } from "../utils/charts/layoutDonut.ts";
import { categoryBreakdown } from "../utils/stats/categoryBreakdown.ts";

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

console.log("stats-check ok");

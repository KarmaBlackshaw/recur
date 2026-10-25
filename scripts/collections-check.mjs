import assert from "node:assert/strict";
import { chunk, groupBy, keyBy, maxBy, orderBy, partition, range, sortBy, sumBy, uniq, uniqBy } from "../utils/collections.ts";
import { round } from "../utils/round.ts";

// round: half-up through the exponent, like lodash — money math relies on these.
assert.equal(round(1.005, 2), 1.01);
assert.equal(round(2.675, 2), 2.68);
assert.equal(round(-1.005, 2), -1);
assert.equal(round(-2.5), -2);
assert.equal(round(0.1 + 0.2, 2), 0.3);
assert.equal(round(1234.5678, -2), 1200);
assert.ok(Object.is(round(-0.001, 2), -0));
assert.ok(Number.isNaN(round(NaN, 2)));
assert.equal(round(Infinity, 2), Infinity);

// orderBy / sortBy: stable, Dates compare by time, missing orders default to asc.
const a = { id: "a", n: 2, d: new Date(2026, 0, 1), s: "x" };
const b = { id: "b", n: 1, d: new Date(2026, 0, 1), s: "y" };
const c = { id: "c", n: 2, d: new Date(2026, 0, 3), s: "x" };
const ids = (rows) => rows.map((r) => r.id).join("");
assert.equal(ids(orderBy([a, b, c], "d", "desc")), "cab");
assert.equal(ids(orderBy([a, b, c], ["n", "s"], ["desc"])), "acb");
assert.equal(ids(orderBy([a, b, c], [(r) => r.s, "n"], ["asc", "desc"])), "acb");
assert.equal(ids(sortBy([c, b, a], "n")), "bca");
assert.equal(ids(sortBy([c, b, a], ["n", (r) => r.d])), "bac");
// null sorts after values and undefined after null; "desc" flips both.
const nil = { id: "z", n: null };
const undef = { id: "u", n: undefined };
assert.equal(ids(orderBy([undef, nil, a, b], "n")), "baz" + "u");
assert.equal(ids(orderBy([a, undef, b, nil], "n", "desc")), "uzab");
assert.equal(ids(sortBy([{ id: "t", f: true }, { id: "f", f: false }], "f")), "ft");

// groupBy / keyBy: plain objects, first-seen key order, prototype names are ordinary keys.
const people = [{ name: "constructor" }, { name: "__proto__" }, { name: "ana" }, { name: "constructor" }];
const byName = groupBy(people, "name");
assert.deepEqual(Object.keys(byName), ["constructor", "__proto__", "ana"]);
assert.equal(byName.constructor.length, 2);
assert.equal(Object.getPrototypeOf(byName), Object.prototype);
assert.equal(keyBy([a, b, c], "n")[2], c);
assert.deepEqual(Object.keys(keyBy(people, "name")), ["constructor", "__proto__", "ana"]);

// sumBy skips undefined; maxBy skips null/undefined/NaN and keeps the first of a tie.
assert.equal(sumBy([{ v: 1 }, { v: undefined }, { v: 2.5 }], "v"), 3.5);
assert.equal(sumBy([], "v"), 0);
assert.equal(maxBy([{ v: null }, { v: NaN }, a, c, { n: 1 }], "n"), a);
assert.equal(maxBy([], "n"), undefined);
assert.equal(maxBy([{ t: "2026-01-02" }, { t: "2026-01-10" }], "t").t, "2026-01-10");

assert.deepEqual(partition([1, 2, 3, 4], (n) => n % 2), [[1, 3], [2, 4]]);
assert.deepEqual(uniq([1, NaN, 1, NaN, 0, -0]), [1, NaN, 0]);
assert.deepEqual(uniqBy(["Ana", "ana", "Ben"], (n) => n.toLowerCase()), ["Ana", "Ben"]);
assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepEqual(chunk([1, 2], 0), []);
assert.deepEqual(range(4), [0, 1, 2, 3]);
assert.deepEqual(range(1, 4), [1, 2, 3]);
assert.deepEqual(range(3, 0), [3, 2, 1]);
assert.deepEqual(range(0), []);

console.log("collections-check: all passed");

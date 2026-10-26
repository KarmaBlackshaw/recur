import assert from "node:assert/strict";
import { mergeClassNames } from "../utils/mergeClassNames.ts";

// A caller's class replaces the variant's class from the same group…
assert.equal(mergeClassNames("text-xs text-textSecondary", "text-paid"), "text-xs text-paid");
assert.equal(mergeClassNames("text-[13px] text-textSecondary", "text-[15px] text-white/75"), "text-[15px] text-white/75");
assert.equal(mergeClassNames("text-xs uppercase tracking-widest text-textSecondary", "tracking-wide normal-case"), "text-xs text-textSecondary tracking-wide normal-case");
assert.equal(mergeClassNames("text-[11px] text-textMuted opacity-80", "mb-1.5 mt-1 opacity-60"), "text-[11px] text-textMuted mb-1.5 mt-1 opacity-60");
// …and alignment, size and color never collide even though all start with `text-`.
assert.equal(mergeClassNames("text-white", "text-center text-sm"), "text-white text-center text-sm");
assert.equal(mergeClassNames("text-white", "text-[#fff] text-[13.5px]"), "text-[#fff] text-[13.5px]");
// Spacing shorthands override the sides they cover; a font size drops an earlier leading.
assert.equal(mergeClassNames("mt-1 mx-2 pl-1", "m-0 px-3"), "m-0 px-3");
assert.equal(mergeClassNames("m-0", "mt-1"), "m-0 mt-1");
assert.equal(mergeClassNames("leading-5", "text-lg"), "text-lg");
assert.equal(mergeClassNames("grow", "flex-1"), "flex-1");
// Modifiers merge per modifier; unknown classes pass through untouched.
assert.equal(mergeClassNames("text-sm ios:text-xs", "ios:text-base"), "text-sm ios:text-base");
assert.equal(mergeClassNames("rounded-lg foo", "foo", undefined), "rounded-lg foo foo");
assert.equal(mergeClassNames("text-[color:red]", "text-white"), "text-white");

console.log("merge-classnames-check: all passed");

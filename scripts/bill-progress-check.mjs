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
const { billProgress, canPayPart, cycleTotals } = await import("../utils/expenses/billProgress.ts");
const { deepEqual, equal } = assert;

deepEqual(billProgress({ bill: 2350, payments: [1000], isPaid: false }), { bill: 2350, paid: 1000, left: 1350 });
deepEqual(billProgress({ bill: null, payments: [1000], isPaid: false }), { bill: null, paid: 1000, left: null });
deepEqual(billProgress({ bill: 2350, payments: [1000, 1350], isPaid: true }), { bill: 2350, paid: 2350, left: 0 });
deepEqual(billProgress({ bill: 1, payments: [0.1, 0.2], isPaid: false }), { bill: 1, paid: 0.3, left: 0.7 });
const p = { bill: 2350, paid: 1000, left: 1350 };
equal(canPayPart(p, 1349.99), true); equal(canPayPart(p, 1350), false); equal(canPayPart(p, 2000), false);
equal(canPayPart(p, 0), false); equal(canPayPart(p, -5), false);
equal(canPayPart({ bill: null, paid: 1000, left: null }, 5000), true);
deepEqual(billProgress({ bill: 500, payments: [1000], isPaid: false }), { bill: 500, paid: 1000, left: 0 });
equal(canPayPart({ bill: 500, paid: 1000, left: 0 }, 1), false);
deepEqual(cycleTotals({ isPaid: false, bill: 2350, payments: [], isCardWithoutRows: false }), { total: 2350, paid: 0, charged: 0 });
deepEqual(cycleTotals({ isPaid: true, bill: 2350, payments: [], isCardWithoutRows: false }), { total: 2350, paid: 2350, charged: 0 });
deepEqual(cycleTotals({ isPaid: true, bill: 2350, payments: [], isCardWithoutRows: true }), { total: 0, paid: 0, charged: 0 });
deepEqual(cycleTotals({ isPaid: false, bill: null, payments: [], isCardWithoutRows: false }), { total: 0, paid: 0, charged: 0 });
deepEqual(cycleTotals({ isPaid: false, bill: 2350, payments: [{ amount: 1000, isCard: false, isCharged: false }], isCardWithoutRows: false }), { total: 2350, paid: 1000, charged: 0 });
deepEqual(cycleTotals({ isPaid: false, bill: 2350, payments: [{ amount: 1000, isCard: true, isCharged: true }], isCardWithoutRows: false }), { total: 1350, paid: 0, charged: 1000 });
deepEqual(cycleTotals({ isPaid: false, bill: null, payments: [{ amount: 1000, isCard: false, isCharged: false }], isCardWithoutRows: false }), { total: 1000, paid: 1000, charged: 0 });
deepEqual(cycleTotals({ isPaid: true, bill: 2350, payments: [{ amount: 1000, isCard: false, isCharged: false }, { amount: 1350, isCard: true, isCharged: true }], isCardWithoutRows: false }), { total: 1000, paid: 1000, charged: 1350 });
deepEqual(cycleTotals({ isPaid: true, bill: 2350, payments: [{ amount: 2350, isCard: true, isCharged: true }], isCardWithoutRows: false }), { total: 0, paid: 0, charged: 2350 });
console.log("bill-progress-check ok");

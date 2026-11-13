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
const { reversedIds } = await import("../utils/reversals/reversedIds.ts");
const { inEffectTransactions } = await import("../utils/reversals/inEffectTransactions.ts");
const { buildReversal } = await import("../utils/reversals/buildReversal.ts");
const { withReversals } = await import("../utils/reversals/withReversals.ts");
const { findOverdraft } = await import("../utils/accounts/findOverdraft.ts");

const txn = (id, accountId, amount, extra = {}) => ({
  id,
  accountId,
  amount,
  kind: "payment",
  expenseId: null,
  cycleYear: null,
  cycleMonth: null,
  transferId: null,
  note: null,
  category: null,
  loanId: null,
  reversesId: null,
  repaymentId: null,
  createdAt: "2026-10-05T08:00:00.000Z",
  ...extra,
});
const reversalOf = (id, original, extra = {}) =>
  txn(id, original.accountId, -original.amount, { kind: "reversal", reversesId: original.id, ...extra });
const ids = (rows) => rows.map((r) => r.id);

assert.deepEqual(reversedIds([]), new Set());
const o1 = txn("o1", "bpi", -500);
const o2 = txn("o2", "bpi", -300);
const o3 = txn("o3", "bpi", 100, { kind: "income" });
const r1 = reversalOf("r1", o1);
const r2 = reversalOf("r2", o2);
assert.deepEqual(reversedIds([o1, o3]), new Set());
assert.deepEqual(reversedIds([o1, r1, o3]), new Set(["o1"]));
assert.deepEqual(reversedIds([o1, o2, r1, r2]), new Set(["o1", "o2"]));

assert.deepEqual(inEffectTransactions([o1, r1, o3]), [o3], "a reversed pair drops both rows");
assert.deepEqual(inEffectTransactions([o1, o3, o2]), [o1, o3, o2], "nothing reversed keeps every row in order");
const repaid = txn("o1b", "bpi", -500, { expenseId: "e1", cycleYear: 2026, cycleMonth: 10 });
assert.deepEqual(ids(inEffectTransactions([o1, r1, repaid, o3])), ["o1b", "o3"], "a re-paid row for the same cycle survives");
assert.deepEqual(ids(inEffectTransactions([o3, r2, o1])), ["o3", "o1"], "a reversal whose original is missing is still dropped");
assert.deepEqual(inEffectTransactions([]), []);

const full = txn("p1", "bpi", 500, {
  expenseId: "e1",
  cycleYear: 2026,
  cycleMonth: 10,
  transferId: "tr1",
  loanId: "L1",
  category: "food",
  note: "lunch",
});
const reversal = buildReversal(full, "2026-10-06T08:00:00.000Z");
assert.equal(reversal.amount, -500, "a credit becomes a debit");
assert.equal(buildReversal(txn("p2", "bpi", -500), "2026-10-06T08:00:00.000Z").amount, 500, "a debit becomes a credit");
assert.equal(buildReversal(txn("p3", "bpi", 33.33), "2026-10-06T08:00:00.000Z").amount, -33.33);
assert.equal(buildReversal(txn("p4", "bpi", 0.1 + 0.2), "2026-10-06T08:00:00.000Z").amount, -0.3, "float sums are rounded to cents");
assert.equal(buildReversal(txn("p5", "bpi", -(0.1 + 0.2)), "2026-10-06T08:00:00.000Z").amount, 0.3);
assert.equal(reversal.kind, "reversal");
assert.equal(reversal.reversesId, "p1");
assert.equal(reversal.accountId, "bpi");
assert.equal(reversal.expenseId, "e1");
assert.equal(reversal.cycleYear, 2026);
assert.equal(reversal.cycleMonth, 10);
assert.equal(reversal.transferId, "tr1");
assert.equal(reversal.loanId, "L1");
assert.equal(reversal.category, null, "category is not copied");
assert.equal(reversal.note, null, "note is not copied");
assert.equal("id" in reversal, false, "the caller assigns the id");
assert.equal(reversal.repaymentId, null, "a null repayment id stays null");
const grouped = txn("g1", "bpi", 500, { kind: "loan_in", loanId: "l1", repaymentId: "rp1" });
assert.equal(buildReversal(grouped, "2026-10-06T08:00:00.000Z").repaymentId, "rp1", "a grouped row's reversal carries the group id");
const excessIncome = txn("g2", "bpi", 40, { kind: "income", loanId: "l1", repaymentId: "rp1" });
const excessReversal = buildReversal(excessIncome, "2026-10-06T08:00:00.000Z");
assert.equal(excessReversal.repaymentId, "rp1", "an excess income row's reversal carries the group id");
assert.equal(excessReversal.amount, -40, "an excess income row's reversal negates the amount");
assert.equal(buildReversal(full, "2026-10-06T08:00:00.000Z").createdAt, "2026-10-06T08:00:00.000Z", "now after the original is used");
assert.equal(
  buildReversal(full, "2026-10-01T08:00:00.000Z").createdAt,
  full.createdAt,
  "a future-dated original keeps its own date",
);
assert.equal(buildReversal(full, full.createdAt).createdAt, full.createdAt, "equal dates stay the same");
assert.throws(() => buildReversal(r1, "2026-10-06T08:00:00.000Z"), /can't be reversed/, "a reversal can't be reversed");

const ledger = [o1, r1, o2, o3, reversalOf("r3", o3)];
assert.deepEqual(withReversals(ledger, ["o1"]), new Set(["o1", "r1"]));
assert.deepEqual(withReversals(ledger, new Set(["o3"])), new Set(["o3", "r3"]), "accepts any iterable");
assert.deepEqual(withReversals(ledger, ["o2"]), new Set(["o2"]), "an id with no reversal is unchanged");
assert.deepEqual(withReversals(ledger, ["r1"]), new Set(["r1"]), "a reversal id keeps itself");
assert.deepEqual(withReversals(ledger, ["o1", "o3"]), new Set(["o1", "r1", "o3", "r3"]));
assert.deepEqual(withReversals([], []), new Set());

const accounts = [
  { id: "bpi", name: "BPI", type: "debit" },
  { id: "card", name: "Card", type: "credit" },
];
const base = [txn("open", "bpi", 500, { kind: "adjust" }), txn("cardOpen", "card", 2000, { kind: "adjust" })];
const check = (transactions, changes) => findOverdraft({ accounts, transactions, changes });
const reversalChange = (original) => [{ accountId: original.accountId, amount: buildReversal(original, "2026-10-06T08:00:00.000Z").amount }];

const bigIncome = txn("inc", "bpi", 600, { kind: "income" });
assert.deepEqual(
  check([...base, bigIncome, txn("spent", "bpi", -700)], reversalChange(bigIncome)),
  { account: accounts[0], shortfall: 200 },
  "reversing income that was already spent overdraws",
);
const smallIncome = txn("inc2", "bpi", 300, { kind: "income" });
assert.equal(check([...base, smallIncome], reversalChange(smallIncome)), undefined, "a reversal that stays above zero is allowed");
const payment = txn("pay", "bpi", -200, { expenseId: "e1" });
assert.equal(check([...base, payment], reversalChange(payment)), undefined, "reversing a debit raises the balance");
const cardCredit = txn("cp", "card", 3000, { kind: "transfer" });
assert.equal(check([...base, cardCredit], reversalChange(cardCredit)), undefined, "credit cards are never overdrawn by a reversal");
const pair = [...base, payment, reversalOf("rp", payment)];
const pairInEffect = inEffectTransactions(pair);
assert.deepEqual(
  check(pairInEffect, [{ accountId: "bpi", amount: -600 }]),
  { account: accounts[0], shortfall: 100 },
  "a payment and its reversal contribute nothing, so only the 500 opening balance covers the change",
);
assert.equal(check(pairInEffect, [{ accountId: "bpi", amount: -400 }]), undefined, "a change within the opening balance is allowed");
assert.deepEqual(ids(inEffectTransactions(pair)), ["open", "cardOpen"]);

console.log("reversal-check passed");

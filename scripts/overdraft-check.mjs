import assert from "node:assert/strict";
import { findOverdraft } from "../utils/accounts/findOverdraft.ts";

const accounts = [
  { id: "bpi", name: "BPI", type: "debit" },
  { id: "cash", name: "Cash", type: "cash" },
  { id: "card", name: "Card", type: "credit" },
];
const txn = (id, accountId, amount, extra = {}) => ({ id, accountId, amount, ...extra });
const transactions = [
  txn("t1", "bpi", 500),
  txn("t2", "cash", 100.1),
  txn("t3", "cash", 0.2),
  txn("t4", "card", 2000),
  txn("pay", "bpi", -200, { expenseId: "e1" }),
  txn("inc", "cash", 50, { kind: "income" }),
];
const check = (changes, isReplaced) => findOverdraft({ accounts, transactions, changes, isReplaced });

assert.equal(check([{ accountId: "bpi", amount: -300 }]), undefined);
assert.deepEqual(check([{ accountId: "bpi", amount: -300.01 }]), { account: accounts[0], shortfall: 0.01 });
assert.equal(check([{ accountId: "cash", amount: -150.3 }]), undefined, "cents add up without float drift");
assert.equal(check([{ accountId: "card", amount: -99999 }]), undefined, "credit cards are never overdrawn");
assert.equal(check([{ accountId: "bpi", amount: -500 }], (t) => t.id === "pay"), undefined, "editing a payment frees its old amount");
assert.deepEqual(check([], (t) => t.id === "inc"), undefined);
assert.deepEqual(
  check([{ accountId: "bpi", amount: 50 }], (t) => t.id === "inc"),
  undefined,
  "moving income away only checks the account it leaves",
);
assert.deepEqual(check([{ accountId: "cash", amount: -150.3 }], (t) => t.id === "inc"), { account: accounts[1], shortfall: 50 });
assert.deepEqual(
  check([{ accountId: "bpi", amount: -400 }, { accountId: "bpi", amount: 150 }]),
  undefined,
  "changes on one account net out",
);

const overdrawn = [txn("o1", "bpi", -80)];
const checkOverdrawn = (changes) => findOverdraft({ accounts, transactions: overdrawn, changes });
assert.equal(checkOverdrawn([{ accountId: "bpi", amount: 30 }]), undefined, "an overdrawn account can still be topped up");
assert.deepEqual(checkOverdrawn([{ accountId: "bpi", amount: -20 }]), { account: accounts[0], shortfall: 100 });

console.log("overdraft-check passed");

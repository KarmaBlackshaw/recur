import assert from "node:assert/strict";
import { findOverdraft } from "../utils/accounts/findOverdraft.ts";
import { loanOutChanges } from "../utils/loans/loanOutChanges.ts";

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

assert.deepEqual(loanOutChanges({ accountId: null, principal: 5000 }), [], "a loan lent before Recur moves no money");
assert.deepEqual(loanOutChanges({ accountId: "bpi", principal: 5000 }), [{ accountId: "bpi", amount: -5000 }]);

const withLoanOut = [...transactions, txn("lo", "bpi", -300, { kind: "loan_out", loanId: "L" })];
assert.equal(
  findOverdraft({ accounts, transactions: withLoanOut, changes: loanOutChanges({ accountId: null, principal: 5000 }) }),
  undefined,
  "saving an existing loan never overdraws, even at ₱0",
);
assert.equal(
  findOverdraft({ accounts, transactions: withLoanOut, changes: [], isReplaced: (t) => t.loanId === "L" && t.kind === "loan_out" }),
  undefined,
  "marking a loan as lent before Recur refunds its loan_out",
);
assert.deepEqual(
  check(loanOutChanges({ accountId: "bpi", principal: 500 })),
  { account: accounts[0], shortfall: 200 },
  "unmarking debits the picked account and is overdraft-checked",
);

console.log("overdraft-check passed");

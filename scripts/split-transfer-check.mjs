import assert from "node:assert/strict";
import { splitTransfer } from "../utils/accounts/splitTransfer.ts";

const accounts = [
  { id: "bpi", type: "debit" },
  { id: "cash", type: "cash" },
  { id: "card", type: "credit" },
];
const row = (id, accountId, kind, amount) => ({ id, accountId, kind, amount });
const fromBpi = row("a", "bpi", "transfer", -500);
const toCash = row("b", "cash", "transfer", 500);
const toCard = row("c", "card", "transfer", -500);
const fee = row("d", "bpi", "fee", -15);
const income = row("e", "cash", "income", 20);

const plain = splitTransfer([toCash, income, fee, fromBpi], accounts);
assert.equal(plain.from, fromBpi);
assert.equal(plain.to, toCash);
assert.equal(plain.fee, fee);
assert.equal(plain.income, income);
assert.equal(plain.isBillPayment, false);

for (const rows of [[fromBpi, toCard], [toCard, fromBpi]]) {
  const payment = splitTransfer(rows, accounts);
  assert.equal(payment.from, fromBpi, "the card's negative side is never From, in either row order");
  assert.equal(payment.to, toCard);
  assert.equal(payment.isBillPayment, true);
}

const fromDeleted = splitTransfer([toCash], accounts);
assert.equal(fromDeleted.from, undefined);
assert.equal(fromDeleted.to, toCash);

const toDeleted = splitTransfer([fromBpi], accounts);
assert.equal(toDeleted.from, fromBpi);
assert.equal(toDeleted.to, undefined);
assert.equal(toDeleted.isBillPayment, false);

const cardFromDeleted = splitTransfer([toCard], accounts);
assert.equal(cardFromDeleted.from, undefined);
assert.equal(cardFromDeleted.to, toCard);
assert.equal(cardFromDeleted.isBillPayment, true);

console.log("split-transfer-check passed");

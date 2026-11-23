import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import dayjs from "dayjs";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { parseTransactionSms } = await import("../utils/sms/parseTransactionSms.ts");
const { guessAccount } = await import("../utils/sms/guessAccount.ts");
const { smsShareHref } = await import("../utils/sms/smsShareHref.ts");
const { equal, deepEqual } = assert;

const today = dayjs("2026-11-21");
const parse = (text) => parseTransactionSms(text, today);
const pick = ({ direction, amount, counterparty, day, bank }) => ({ direction, amount, counterparty, day, bank });

deepEqual(
  pick(parse("You have sent PHP 1,500.00 to JUAN DELA CRUZ 09171234567 on 11-20-2026 03:15 PM with MSG: . Your new balance is PHP 2,345.67. Ref. No. 1234567890123.")),
  { direction: "expense", amount: 1500, counterparty: "JUAN DELA CRUZ", day: "2026-11-20", bank: null }
);
deepEqual(
  pick(parse("You have received PHP 1,000.00 of GCash from MARIA SANTOS 09181234567. Your new balance is PHP 3,345.67. Ref. No. 9876543210.")),
  { direction: "income", amount: 1000, counterparty: "MARIA SANTOS", day: null, bank: "gcash" }
);
deepEqual(
  pick(parse("You have paid PHP 250.50 via GCash to MERALCO on 11/19/2026. Ref No. 555.")),
  { direction: "expense", amount: 250.5, counterparty: "MERALCO", day: "2026-11-19", bank: "gcash" }
);
deepEqual(
  pick(parse("Maya: Your purchase of ₱1,250.00 at SHOPEE PH on 18 Nov 2026 was successful. Avail bal: ₱500.00")),
  { direction: "expense", amount: 1250, counterparty: "SHOPEE PH", day: "2026-11-18", bank: "maya" }
);
deepEqual(
  pick(parse("You received P500.00 from Ana Reyes on Nov 17, 2026 to your Maya Wallet.")),
  { direction: "income", amount: 500, counterparty: "Ana Reyes", day: "2026-11-17", bank: "maya" }
);
deepEqual(
  pick(parse("BPI: Your account XXXX1234 has been debited PHP 2,000.00 on 11/20/26 for ATM withdrawal.")),
  { direction: "expense", amount: 2000, counterparty: "ATM withdrawal", day: "2026-11-20", bank: "bpi" }
);
deepEqual(
  pick(parse("BDO: You received PHP 25,000.00 via InstaPay from ACME CORP on 2026-11-15.")),
  { direction: "income", amount: 25000, counterparty: "ACME CORP", day: "2026-11-15", bank: "bdo" }
);
deepEqual(
  pick(parse("You have sent PHP 500.00 to BPI account ending 4321 via GCash on Nov 20.")),
  { direction: "expense", amount: 500, counterparty: "BPI", day: "2026-11-20", bank: "gcash" }
);

const card = parse("Thank you for using your BDO Credit Card ending 9876 for PHP 899.00 at NETFLIX.COM on Nov 20, 2026.");
deepEqual(pick(card), { direction: "expense", amount: 899, counterparty: "NETFLIX.COM", day: "2026-11-20", bank: "bdo" });
equal(card.isCard, true);
equal(card.lastDigits, "9876");

equal(parse("Your account was credited PHP 100.00 on 12/25/2026.").day, "2026-11-21");
equal(parse("Paid PHP 300 on 25/10/2026").day, "2026-10-25");
equal(parse("Paid P100 on Dec 30").day, "2025-12-30");

const unknown = parse("See you at lunch tomorrow!");
deepEqual(pick(unknown), { direction: "expense", amount: null, counterparty: null, day: null, bank: null });
deepEqual(pick(parse("BDO: meet me at the BDO branch on Nov 20.")), { direction: "expense", amount: null, counterparty: null, day: null, bank: null });

const account = (id, name, type, bank = null) => ({ id, name, type, bank });
const accounts = [
  account("cash", "Cash", "cash"),
  account("bdo-savings", "BDO Savings", "debit", "bdo"),
  account("bdo-card", "BDO Gold 9876", "credit", "bdo"),
  account("bpi-1", "BPI 1234", "debit", "bpi"),
  account("bpi-2", "BPI Payroll", "debit", "bpi"),
  account("wallet", "My GCash", "debit"),
];
equal(guessAccount(card, accounts), "bdo-card");
equal(guessAccount(parse("BDO: You received PHP 100.00 via InstaPay from X on 11/20/2026."), accounts), "bdo-savings");
equal(guessAccount(parse("BPI Payroll ending 9999: debited PHP 50"), accounts), "bpi-1");
equal(guessAccount(parse("BPI: Your account XXXX1234 has been debited PHP 2,000.00"), accounts.slice(0, 4).concat(accounts[4]).reverse()), "bpi-1");
equal(guessAccount(parse("You have received PHP 1.00 of GCash from X"), accounts), "wallet");
equal(guessAccount(parse("You have sent PHP 1.00 to X"), accounts), null);

const shared = "You have received PHP 1,000.00 of GCash from MARIA & CO.";
equal(smsShareHref(shared), `/income/add?sms=${encodeURIComponent(shared)}`);
equal(smsShareHref("  Paid PHP 5 to Y  "), `/expense/add?type=regular&sms=${encodeURIComponent("Paid PHP 5 to Y")}`);

console.log("sms-import-check ok");

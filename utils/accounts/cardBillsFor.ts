import dayjs from "dayjs";
import { computeBill } from "@/utils/cardBills";
import type { Account, AccountTransaction, CardBill, CardBillOverride } from "@/types";

// Every card's statement due in the given month. Pass in-effect transactions, not the raw ledger.
export function cardBillsFor({
  accounts,
  transactions,
  billOverrides,
  year,
  month,
  now,
}: {
  accounts: Account[];
  transactions: AccountTransaction[];
  billOverrides: CardBillOverride[];
  year: number;
  month: number;
  now: Date;
}): CardBill[] {
  const bills: CardBill[] = [];
  for (const account of accounts) {
    const { statementDay, dueDay } = account;
    if (account.type !== "credit" || statementDay == null || dueDay == null) {
      continue;
    }
    const txns = transactions.filter((t) => t.accountId === account.id);
    const override =
      billOverrides.find((o) => o.accountId === account.id && o.year === year && o.month === month)?.amount ?? null;
    const bill = computeBill({ txns, statementDay, dueDay, year, month, override, now });
    if (dayjs(bill.cutoff).isBefore(dayjs(account.createdAt).startOf("month"))) {
      continue;
    }
    // An archived card has no bills after it was archived; earlier ones stay part of past months.
    if (account.archivedAt && dayjs(bill.dueDate).isAfter(dayjs(account.archivedAt), "day")) {
      continue;
    }
    bills.push({ ...bill, account, year, month });
  }
  return bills;
}

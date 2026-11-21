import dayjs from "dayjs";
import type { Account, CardBill, Expense, Status } from "@/types";
import { range } from "@/utils/collections";
import { billDates, openCardBills } from "@/utils/cardBills";
import { getDueDateForMonth, hasCycleIn } from "@/utils/dateHelpers";
import { payFromAccountId } from "@/utils/accounts/payFromAccountId";
import type { BillProgress } from "@/utils/expenses/billProgress";
import { OVERDUE_LOOKBACK_MONTHS } from "@/utils/computeDueBills";
import { monthKey } from "@/utils/monthKey";

export interface ForecastOutflow {
  key: string;
  name: string;
  amount: number;
  date: Date;   // The day it's expected to leave: its due date, or today once it's overdue.
  isOverdue: boolean;
  accountId: string | null;   // The debit or cash account it leaves. Null: a card bill with no Pay bill from.
  cardId: string | null;   // The card it goes through, if any.
}

export interface ForecastOutflows {
  outflows: ForecastOutflow[];
  unknownCount: number;   // Bills in the window without an amount yet, left out of the forecast.
}

const isMoneyAccount = (account: Account | undefined): account is Account =>
  account?.type === "debit" || account?.type === "cash";

// Bills expected to leave the user's debit and cash accounts from today through `days` ahead, soonest first:
// unpaid recurring cycles (from the Overdue lookback on) and open card bills. A cycle paid from a card becomes a
// charge on the first bill whose statement closes on or after it's charged, unless that bill's amount is set.
export function forecastOutflows({
  expenses,
  getMonthStatus,
  getBillProgress,
  getCardBills,
  activeAccounts,
  today,
  days,
}: {
  expenses: Expense[];
  getMonthStatus: (id: string, year: number, month: number) => Status;
  getBillProgress: (expense: Expense, year: number, month: number) => BillProgress;
  getCardBills: (year: number, month: number) => CardBill[];
  activeAccounts: Account[];
  today: Date;
  days: number;
}): ForecastOutflows {
  const start = dayjs(today).startOf("day");
  const end = start.add(days, "day");
  const byId = new Map(activeAccounts.map((a) => [a.id, a]));
  const billAccountOf = (card: Account) => {
    const from = byId.get(card.payBillFromAccountId ?? "");
    return isMoneyAccount(from) ? from.id : null;
  };
  const leaveOn = (due: Date) => (dayjs(due).isBefore(start) ? start : dayjs(due).startOf("day")).toDate();
  const isInWindow = (date: Date) => !dayjs(date).isAfter(end);

  // The due date of the bill a card charge lands on; null when that bill's amount is set, which already counts it.
  const cardBillDue = (card: Account, chargeOn: Date): Date | null => {
    if (card.statementDay == null || card.dueDay == null) {
      return chargeOn;
    }
    const chargeMonth = dayjs(chargeOn).startOf("month");
    for (const ahead of range(3)) {
      const at = chargeMonth.add(ahead, "month");
      const { cutoff, dueDate } = billDates(card.statementDay, card.dueDay, at.year(), at.month());
      if (!dayjs(cutoff).isBefore(chargeOn, "day")) {
        const bill = getCardBills(at.year(), at.month()).find((b) => b.account.id === card.id);
        return bill && !bill.isEstimate ? null : dueDate;
      }
    }
    return null;
  };

  const outflows: ForecastOutflow[] = [];
  let unknownCount = 0;

  const lastMonth = end.startOf("month");
  const firstMonth = start.startOf("month").subtract(OVERDUE_LOOKBACK_MONTHS, "month");
  for (const offset of range(lastMonth.diff(firstMonth, "month") + 1)) {
    const at = firstMonth.add(offset, "month");
    const [year, month] = [at.year(), at.month()];
    for (const expense of expenses) {
      if (!hasCycleIn(expense, year, month) || getMonthStatus(expense.id, year, month) !== "unpaid") {
        continue;
      }
      const due = getDueDateForMonth(expense.dueDay, year, month);
      const chargeOn = leaveOn(due);
      if (!isInWindow(chargeOn)) {
        continue;
      }
      const { left } = getBillProgress(expense, year, month);
      if (left == null) {
        unknownCount++;
        continue;
      }
      if (left <= 0) {
        continue;
      }
      const fromId = payFromAccountId(expense, activeAccounts);
      const from = byId.get(fromId);
      const card = from?.type === "credit" ? from : null;
      const date = card ? cardBillDue(card, chargeOn) : chargeOn;
      if (date == null || !isInWindow(date)) {
        continue;
      }
      outflows.push({
        key: monthKey(expense.id, year, month),
        name: expense.name,
        amount: left,
        date: leaveOn(date),
        isOverdue: dayjs(due).isBefore(start),
        accountId: card ? billAccountOf(card) : fromId,
        cardId: card?.id ?? null,
      });
    }
  }

  const aheadMonths = lastMonth.diff(start.startOf("month"), "month") + 1;
  for (const bill of openCardBills(getCardBills, start.toDate(), OVERDUE_LOOKBACK_MONTHS, aheadMonths)) {
    const date = leaveOn(bill.dueDate);
    if (bill.isPaid || bill.remaining <= 0 || !isInWindow(date)) {
      continue;
    }
    outflows.push({
      key: `bill-${bill.account.id}-${bill.year}-${bill.month}`,
      name: bill.account.name,
      amount: bill.remaining,
      date,
      isOverdue: dayjs(bill.dueDate).isBefore(start),
      accountId: billAccountOf(bill.account),
      cardId: bill.account.id,
    });
  }

  outflows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name));
  return { outflows, unknownCount };
}

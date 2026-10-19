import React from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import sumBy from "lodash/sumBy";
import { formatAmount, isEndedOn } from "@/utils/dateHelpers";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { KpiCard } from "@/components/kpi/KpiCard";
import type { Expense } from "@/types";

interface Props {
  year: number;
  month: number;
  recurringOnly?: boolean;
}

export function KpiRow({ year, month, recurringOnly = false }: Props) {
  const { expenses, resolveAmount, getMonthStatus } = useExpenses();
  const isInMonth = (e: Expense) => {
    if (e.recurrence !== "one-off") {
      return !isEndedOn(e.endYear, e.endMonth, year, month);
    }
    if (recurringOnly) {
      return false;
    }
    const d = dayjs(e.paidDate ?? e.createdAt);
    return d.year() === year && d.month() === month;
  };
  const { getCardBills, isCardCharge, isCharged, transactions } = useAccounts();
  const source = expenses.filter(isInMonth);

  const cycleOf = (e: Expense) =>
    e.recurrence === "one-off" ? { cycleYear: null, cycleMonth: null } : { cycleYear: year, cycleMonth: month };

  const resolved = source.map((e) => {
    const { cycleYear, cycleMonth } = cycleOf(e);
    return {
      expense: e,
      status: getMonthStatus(e.id, year, month),
      isCard: isCardCharge(e.id, cycleYear, cycleMonth, e.accountId),
    };
  });
  const counted = resolved.filter(({ isCard, status }) => !isCard || status === "unpaid");
  const cardExpenses = resolved.filter(({ isCard }) => isCard);

  const amountOf = ({ expense }: { expense: Expense }) => resolveAmount(expense, year, month);
  const bills = recurringOnly ? [] : getCardBills(year, month).filter((b) => b.amount > 0);

  const fees = recurringOnly
    ? 0
    : -sumBy(
        transactions.filter((t) => {
          const d = dayjs(t.createdAt);
          return t.kind === "fee" && d.year() === year && d.month() === month;
        }),
        "amount"
      );

  const total = sumBy(counted, amountOf) + sumBy(bills, (b) => b.amount) + fees;
  const paid =
    sumBy(counted.filter(({ status }) => status === "paid"), amountOf) +
    sumBy(bills, (b) => Math.min(b.paid, b.amount)) +
    fees;
  const unpaid = total - paid;
  const charged = sumBy(
    cardExpenses.filter(({ expense, status }) => {
      if (status !== "paid") {
        return false;
      }
      const { cycleYear, cycleMonth } = cycleOf(expense);
      return isCharged(expense.id, cycleYear, cycleMonth);
    }),
    amountOf
  );

  return (
    <View className="px-5 py-2 gap-2.5">
      <View className="flex-row gap-2.5">
        <KpiCard label="Total" value={formatAmount(total)} tone="primary" icon="wallet-outline" />
        <KpiCard label="Paid" value={formatAmount(paid)} tone="paid" icon="checkmark-circle-outline" />
      </View>
      <View className="flex-row gap-2.5">
        <KpiCard label="Charged" value={formatAmount(charged)} tone="charged" icon="card-outline" />
        <KpiCard label="To pay" value={formatAmount(unpaid)} tone="neutral" icon="time-outline" />
      </View>
    </View>
  );
}

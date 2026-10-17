import React from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import sumBy from "lodash/sumBy";
import { formatAmount, isEndedOn } from "@/utils/dateHelpers";
import { useExpenses } from "@/context/ExpenseContext";
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
  const source = expenses.filter(isInMonth);

  const resolvedExpenses = source.map((e) => ({
    ...e,
    status: getMonthStatus(e.id, year, month),
  }));

  const amountOf = (e: Expense) => resolveAmount(e, year, month);
  const total = sumBy(resolvedExpenses, amountOf);
  const paid = sumBy(resolvedExpenses.filter((e) => e.status === "paid"), amountOf);
  const unpaid = sumBy(resolvedExpenses.filter((e) => e.status === "unpaid"), amountOf);

  return (
    <View className="flex-row px-5 gap-2.5 py-2">
      <KpiCard label="Total" value={formatAmount(total)} tone="primary" icon="wallet-outline" />
      <KpiCard label="Paid" value={formatAmount(paid)} tone="paid" icon="checkmark-circle-outline" />
      <KpiCard label="To pay" value={formatAmount(unpaid)} tone="neutral" icon="time-outline" />
    </View>
  );
}

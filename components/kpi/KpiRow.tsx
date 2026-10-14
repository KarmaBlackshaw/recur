import React from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import { formatAmount, isEndedOn } from "../../utils/dateHelpers";
import { useExpenses } from "../../context/ExpenseContext";
import { KpiCard } from "./KpiCard";
import type { Expense } from "../../types";

interface Props {
  year: number;
  month: number;
  recurringOnly?: boolean;
}

export function KpiRow({ year, month, recurringOnly = false }: Props) {
  const { expenses, getMonthAmount, getMonthStatus } = useExpenses();
  const isInMonth = (e: Expense) => {
    if (e.recurrence !== "one-off") return !isEndedOn(e.endYear, e.endMonth, year, month);
    if (recurringOnly) return false;
    const d = dayjs(e.paidDate ?? e.createdAt);
    return d.year() === year && d.month() === month;
  };
  const source = expenses.filter(isInMonth);

  function resolveAmount(e: Expense): number {
    if (e.isVariable) return getMonthAmount(e.id, year, month) ?? 0;
    return e.amount ?? 0;
  }

  const resolvedExpenses = source.map((e) => ({
    ...e,
    status: getMonthStatus(e.id, year, month),
  }));

  const total = resolvedExpenses.reduce((sum, e) => sum + resolveAmount(e), 0);
  const paid = resolvedExpenses
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + resolveAmount(e), 0);
  const unpaid = resolvedExpenses
    .filter((e) => e.status === "unpaid")
    .reduce((sum, e) => sum + resolveAmount(e), 0);

  return (
    <View className="flex-row px-5 gap-2.5 py-2">
      <KpiCard label="Total" value={formatAmount(total)} tone="primary" icon="wallet-outline" />
      <KpiCard label="Paid" value={formatAmount(paid)} tone="paid" icon="checkmark-circle-outline" />
      <KpiCard label="To pay" value={formatAmount(unpaid)} tone="neutral" icon="time-outline" />
    </View>
  );
}

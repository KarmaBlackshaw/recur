import React from "react";
import { View } from "react-native";
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
  const source = (recurringOnly
    ? expenses.filter((e) => e.recurrence !== "one-off")
    : expenses
  ).filter((e) => !isEndedOn(e.endYear, e.endMonth, year, month));

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
    <View className="flex-row px-4 gap-2.5 py-2">
      <KpiCard
        label="Total"
        value={formatAmount(total)}
        valueColor="#818CF8"
        bgColor="rgba(99,102,241,0.10)"
        borderColor="rgba(99,102,241,0.18)"
        icon="wallet-outline"
      />
      <KpiCard
        label="Paid"
        value={formatAmount(paid)}
        valueColor="#34D399"
        bgColor="rgba(52,211,153,0.10)"
        borderColor="rgba(52,211,153,0.18)"
        icon="checkmark-circle-outline"
      />
      <KpiCard
        label="Unpaid"
        value={formatAmount(unpaid)}
        valueColor={unpaid > 0 ? "#F87171" : "rgba(255,255,255,0.4)"}
        bgColor={unpaid > 0 ? "rgba(248,113,113,0.10)" : "rgba(255,255,255,0.04)"}
        borderColor={unpaid > 0 ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.07)"}
        icon="time-outline"
      />
    </View>
  );
}

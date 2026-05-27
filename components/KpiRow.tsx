import React from "react";
import { ScrollView, View, Text } from "react-native";
import type { Expense } from "../types";

interface Props {
  expenses: Expense[];
}

export function KpiRow({ expenses }: Props) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paid = expenses.filter((e) => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);
  const unpaid = expenses.filter((e) => e.status === "unpaid").reduce((sum, e) => sum + e.amount, 0);

  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 gap-3 py-2"
    >
      <KpiCard label="Total" value={fmt(total)} color="#3B82F6" />
      <KpiCard label="Paid" value={fmt(paid)} color="#059669" />
      <KpiCard
        label="Unpaid"
        value={fmt(unpaid)}
        color={unpaid > 0 ? "#DC2626" : "rgba(255,255,255,0.4)"}
      />
    </ScrollView>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="bg-surface rounded-xl p-4 min-w-[120px] border border-border">
      <Text className="text-lg font-caveat-bold mb-0.5" style={{ color }}>{value}</Text>
      <Text className="text-white/50 text-[11px] font-quicksand-medium uppercase tracking-widest">
        {label}
      </Text>
    </View>
  );
}

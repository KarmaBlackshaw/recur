import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatAmount } from "../utils/dateHelpers";
import type { Expense } from "../types";

interface Props {
  expenses: Expense[];
  getMonthAmount: (id: string, year: number, month: number) => number | null;
  year: number;
  month: number;
}

interface KpiCardProps {
  label: string;
  value: string;
  valueColor: string;
  bgColor: string;
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function KpiRow({ expenses, getMonthAmount, year, month }: Props) {
  function resolveAmount(e: Expense): number {
    if (e.isVariable) {
      const actual = getMonthAmount(e.id, year, month);
      return actual ?? 0;
    }
    return e.amount ?? 0;
  }

  const total = expenses.reduce((sum, e) => sum + resolveAmount(e), 0);
  const paid = expenses
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + resolveAmount(e), 0);
  const unpaid = expenses
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

function KpiCard({ label, value, valueColor, bgColor, borderColor, icon }: KpiCardProps) {
  return (
    <View
      className="flex-1 rounded-2xl px-3 py-3 border"
      style={{ backgroundColor: bgColor, borderColor }}
    >
      <View
        className="w-8 h-8 rounded-xl items-center justify-center mb-2"
        style={{ backgroundColor: borderColor }}
      >
        <Ionicons name={icon} size={16} color={valueColor} />
      </View>
      <Text
        className="text-[18px] leading-tight"
        style={{ color: valueColor, fontFamily: "Oswald_Regular" }}
      >
        {value}
      </Text>
      <Text className="text-white/40 text-[10px] font-['Quicksand_500Medium'] uppercase tracking-widest mt-0.5">
        {label}
      </Text>
    </View>
  );
}

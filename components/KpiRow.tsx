import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import type { Expense } from "../types";
import { colors } from "../constants/theme";

interface Props {
  expenses: Expense[];
}

export function KpiRow({ expenses }: Props) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paid = expenses.filter((e) => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);
  const unpaid = expenses.filter((e) => e.status === "unpaid").reduce((sum, e) => sum + e.amount, 0);

  const fmt = (n: number) => `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <KpiCard label="Total" value={fmt(total)} color={colors.secondary} />
      <KpiCard label="Paid" value={fmt(paid)} color={colors.paid} />
      <KpiCard label="Unpaid" value={fmt(unpaid)} color={unpaid > 0 ? colors.overdue : "rgba(255,255,255,0.4)"} />
    </ScrollView>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 12,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    minWidth: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    fontSize: 18,
    fontFamily: "Caveat_700Bold",
    marginBottom: 2,
  },
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Quicksand_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

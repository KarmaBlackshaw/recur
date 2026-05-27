import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import type { Status } from "../types";
import { colors } from "../constants/theme";

interface Props {
  status: Status;
  overdue?: boolean;
  onToggle?: () => void;
}

export function StatusBadge({ status, overdue, onToggle }: Props) {
  const isPaid = status === "paid";
  const isOverdueUnpaid = !isPaid && overdue;

  const bg = isPaid ? colors.paid : isOverdueUnpaid ? colors.overdue : "#334155";
  const label = isPaid ? "Paid" : isOverdueUnpaid ? "Overdue" : "Unpaid";

  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.badge, { backgroundColor: bg }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Status: ${label}. Tap to toggle.`}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: "center",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Quicksand_700Bold",
    letterSpacing: 0.5,
  },
});

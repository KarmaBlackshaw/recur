import React from "react";
import { TouchableOpacity, Text } from "react-native";
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
      className="rounded-xl px-2.5 py-1 min-w-[64px] items-center"
      style={{ backgroundColor: bg }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Status: ${label}. Tap to toggle.`}
    >
      <Text className="text-white text-[11px] font-quicksand-bold tracking-wide">{label}</Text>
    </TouchableOpacity>
  );
}

import React from "react";
import { TouchableOpacity, Text } from "react-native";
import type { Status } from "../types";

interface Props {
  status: Status;
  overdue?: boolean;
  onToggle?: () => void;
}

export function StatusBadge({ status, overdue, onToggle }: Props) {
  const isPaid = status === "paid";
  const isOverdueUnpaid = !isPaid && overdue;

  const bgClass = isPaid
    ? "bg-paid"
    : isOverdueUnpaid
    ? "bg-overdue"
    : "bg-white/[0.12] border border-white/[0.18]";

  const label = isPaid ? "Paid" : isOverdueUnpaid ? "Overdue" : "Unpaid";

  return (
    <TouchableOpacity
      onPress={onToggle}
      className={`rounded-xl px-[10px] py-1 min-w-[64px] items-center ${bgClass}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Status: ${label}. Tap to toggle.`}
    >
      <Text className="text-white text-[11px] font-['Quicksand_700Bold'] tracking-[0.5px]">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

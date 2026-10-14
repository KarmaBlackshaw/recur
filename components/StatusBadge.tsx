import React from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { FeatherIconName, Status } from "../types";
import { colors } from "../constants/theme";
import { AppText } from "./ui/AppText";

interface Props {
  status: Status;
  overdue?: boolean;
  onToggle?: () => void;
}

interface Tone {
  label: string;
  icon: FeatherIconName;
  color: string;
  containerClass: string;
  textClass: string;
}

const PAID: Tone = {
  label: "Paid",
  icon: "check",
  color: colors.paid,
  containerClass: "bg-paid/15 border-paid/30",
  textClass: "text-paid",
};

const OVERDUE: Tone = {
  label: "Overdue",
  icon: "alert-triangle",
  color: colors.overdue,
  containerClass: "bg-overdue/15 border-overdue/30",
  textClass: "text-overdue",
};

const UNPAID: Tone = {
  label: "Unpaid",
  icon: "circle",
  color: colors.textSecondary,
  containerClass: "bg-white/[0.08] border-border",
  textClass: "text-textSecondary",
};

export function StatusBadge({ status, overdue, onToggle }: Props) {
  const isPaid = status === "paid";
  const tone = isPaid ? PAID : overdue ? OVERDUE : UNPAID;

  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={!onToggle}
      activeOpacity={0.7}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 min-h-[32px] ${tone.containerClass}`}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole={onToggle ? "button" : "text"}
      accessibilityLabel={onToggle ? (isPaid ? "Mark as unpaid" : "Mark as paid") : tone.label}
      accessibilityHint={onToggle ? `Currently ${tone.label.toLowerCase()}` : undefined}
      accessibilityState={onToggle ? { checked: isPaid } : undefined}
    >
      <Feather name={tone.icon} size={12} color={tone.color} />
      <AppText variant="body-bold" className={`text-xs tracking-[0.5px] ${tone.textClass}`}>
        {tone.label}
      </AppText>
    </TouchableOpacity>
  );
}

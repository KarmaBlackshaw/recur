import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { FeatherIconName, Status } from "@/types";
import { colors } from "@/constants/theme";
import { AppText } from "@/components/ui/AppText";

interface Props {
  status: Status;
  overdue?: boolean;
  charged?: boolean;
  label?: string;
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

const CHARGED: Tone = {
  label: "Charged",
  icon: "credit-card",
  color: colors.secondary,
  containerClass: "bg-secondary/15 border-secondary/30",
  textClass: "text-secondary",
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

export function StatusBadge({ status, overdue, charged, label }: Props) {
  const isPaid = status === "paid";
  const tone = isPaid ? (charged ? CHARGED : PAID) : overdue ? OVERDUE : UNPAID;
  const text = label ?? tone.label;

  return (
    <View
      className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${tone.containerClass}`}
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Feather name={tone.icon} size={10} color={tone.color} />
      <AppText variant="body-bold" className={`text-[11px] tracking-[0.5px] ${tone.textClass}`}>
        {text}
      </AppText>
    </View>
  );
}

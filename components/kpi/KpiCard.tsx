import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../ui/AppText";
import { colors } from "../../constants/theme";

export type KpiTone = "primary" | "paid" | "overdue" | "neutral";

const TONE: Record<KpiTone, { card: string; iconBg: string; value: string; icon: string }> = {
  primary: { card: "bg-primary/10 border-primary/20", iconBg: "bg-primary/20", value: "text-secondary", icon: colors.secondary },
  paid: { card: "bg-paid/10 border-paid/20", iconBg: "bg-paid/20", value: "text-paid", icon: colors.paid },
  overdue: { card: "bg-overdue/10 border-overdue/20", iconBg: "bg-overdue/20", value: "text-overdue", icon: colors.overdue },
  neutral: { card: "bg-surface border-border", iconBg: "bg-white/[0.07]", value: "text-white", icon: colors.textSecondary },
};

export interface KpiCardProps {
  label: string;
  value: string;
  tone: KpiTone;
  icon: keyof typeof Ionicons.glyphMap;
}

export function KpiCard({ label, value, tone, icon }: KpiCardProps) {
  const t = TONE[tone];
  return (
    <View className={`flex-1 rounded-2xl px-3 py-3 border ${t.card}`}>
      <View className={`w-8 h-8 rounded-xl items-center justify-center mb-2 ${t.iconBg}`}>
        <Ionicons name={icon} size={16} color={t.icon} />
      </View>
      <Text
        className={`text-[18px] leading-tight font-oswald ${t.value}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={1.4}
      >
        {value}
      </Text>
      <AppText variant="meta" className="mt-0.5" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

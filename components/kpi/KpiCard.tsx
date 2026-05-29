import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface KpiCardProps {
  label: string;
  value: string;
  valueColor: string;
  bgColor: string;
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export function KpiCard({ label, value, valueColor, bgColor, borderColor, icon }: KpiCardProps) {
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

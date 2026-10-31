import React from "react";
import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";

interface AppDetailRowProps {
  label: string;
  value: string;
}

export function AppDetailRow({ label, value }: AppDetailRowProps) {
  return (
    <View className="flex-row justify-between gap-4 py-1.5">
      <AppText variant="meta">{label}</AppText>
      <AppText variant="body-medium" className="shrink text-right">{value}</AppText>
    </View>
  );
}

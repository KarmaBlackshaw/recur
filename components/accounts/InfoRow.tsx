import React from "react";
import { View } from "react-native";
import { AppText } from "@/components/ui/AppText";

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4 py-1.5">
      <AppText variant="meta">{label}</AppText>
      <AppText variant="body-medium" className="shrink text-right text-sm">{value}</AppText>
    </View>
  );
}

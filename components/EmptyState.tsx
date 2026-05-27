import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onAdd?: () => void;
}

export function EmptyState({ onAdd }: Props) {
  return (
    <View className="flex-1 items-center justify-center pt-20 gap-3">
      <Ionicons name="wallet-outline" size={64} color="rgba(255,255,255,0.15)" />
      <Text className="text-white/50 text-lg font-quicksand-bold">No expenses yet</Text>
      <Text className="text-white/30 text-sm font-quicksand text-center px-8">
        Tap + to add your first recurring expense
      </Text>
    </View>
  );
}

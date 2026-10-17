import React from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/constants/theme";

export function LoadingState() {
  return (
    <View
      className="flex-1 items-center justify-center"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator color={colors.secondary} size="large" />
    </View>
  );
}

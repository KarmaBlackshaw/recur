import React from "react";
import { TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

interface CategoryFilterChipProps {
  category: string;
  icon: FeatherIconName;
  meta: string;
  onClear: () => void;
}

export function CategoryFilterChip({ category, icon, meta, onClear }: CategoryFilterChipProps) {
  return (
    <View className="flex-row items-center gap-3 px-5 mt-1">
      <TouchableOpacity
        onPress={onClear}
        activeOpacity={0.7}
        className="shrink flex-row items-center gap-2 min-h-[44px] pl-4 pr-3 rounded-full border bg-primary/15 border-primary"
      >
        <Feather name={icon} size={14} color={colors.secondary} />
        <AppText variant="body-bold" className="shrink text-sm text-secondary" numberOfLines={1}>
          {category}
        </AppText>
        <Feather name="x" size={16} color={colors.secondary} />
      </TouchableOpacity>
      <AppText variant="meta">{meta}</AppText>
    </View>
  );
}

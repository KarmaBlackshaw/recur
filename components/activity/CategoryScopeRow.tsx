import React from "react";
import { TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { ICON_TONE } from "@/components/ui/AppListRow";
import type { FeatherIconName } from "@/types";

interface CategoryScopeRowProps {
  category: string;
  icon: FeatherIconName;
  meta: string;
  onShowAll: () => void;
}

export function CategoryScopeRow({ category, icon, meta, onShowAll }: CategoryScopeRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-5 mt-2 min-h-[52px]">
      <View className={`w-[36px] h-[36px] rounded-xl items-center justify-center ${ICON_TONE.neutral.tile}`}>
        <Feather name={icon} size={17} color={ICON_TONE.neutral.glyph} />
      </View>
      <View className="flex-1">
        <AppText variant="body-bold" className="text-[14px]" numberOfLines={1}>
          {category}
        </AppText>
        <AppText variant="meta">{meta}</AppText>
      </View>
      <TouchableOpacity
        onPress={onShowAll}
        activeOpacity={0.7}
        className="min-h-[44px] justify-center pl-3"
      >
        <AppText variant="body-bold" className="text-sm text-secondary">
          Show all
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

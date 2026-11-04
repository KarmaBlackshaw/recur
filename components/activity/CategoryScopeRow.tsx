import React from "react";
import { TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { AppText } from "@/components/ui/AppText";
import { ICON_TONE } from "@/components/ui/AppListRow";
import { colors } from "@/constants/theme";
import type { FeatherIconName } from "@/types";

interface CategoryScopeRowProps {
  category: string;
  icon: FeatherIconName;
  meta: string;
  // Opens the category picker, to switch to another category.
  onPick: () => void;
  onShowAll: () => void;
}

export function CategoryScopeRow({ category, icon, meta, onPick, onShowAll }: CategoryScopeRowProps) {
  return (
    <View className="flex-row items-center px-5 mt-2">
      <TouchableOpacity onPress={onPick} activeOpacity={0.7} className="flex-1 flex-row items-center gap-3 min-h-[52px]">
        <View className={`w-[36px] h-[36px] rounded-xl items-center justify-center ${ICON_TONE.neutral.tile}`}>
          <Feather name={icon} size={17} color={ICON_TONE.neutral.glyph} />
        </View>
        <View className="shrink">
          <View className="flex-row items-center gap-1">
            <AppText variant="body-bold" className="text-[14px] shrink" numberOfLines={1}>
              {category}
            </AppText>
            <Feather name="chevron-down" size={16} color={colors.textMuted} />
          </View>
          <AppText variant="meta">{meta}</AppText>
        </View>
      </TouchableOpacity>
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

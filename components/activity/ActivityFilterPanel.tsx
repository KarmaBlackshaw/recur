import React from "react";
import { Keyboard, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppChips } from "@/components/ui/AppChips";
import { AppButton } from "@/components/ui/AppButton";
import { ICON_TONE } from "@/components/ui/AppListRow";
import { colors } from "@/constants/theme";
import type { ActivitySegment, FeatherIconName, TOption } from "@/types";

interface ActivityFilterPanelProps {
  search: string;
  onSearchChange: (search: string) => void;
  types: TOption<ActivitySegment>[];
  type: ActivitySegment;
  onTypeChange: (type: ActivitySegment) => void;
  // The filtered category, its glyph and how many rows Activity lists for it.
  category?: { name: string; icon: FeatherIconName; meta: string };
  // Opens the category sheet.
  onPickCategory: () => void;
  onClear: () => void;
  onClose: () => void;
}

// The card Activity's filter toggle opens under the header, pushing the page down: keyword, type and category, applied together as they change.
export function ActivityFilterPanel({
  search,
  onSearchChange,
  types,
  type,
  onTypeChange,
  category,
  onPickCategory,
  onClear,
  onClose,
}: ActivityFilterPanelProps) {
  const isReducedMotion = useReducedMotion();
  const isFiltered = search.trim() !== "" || type !== "all" || category != null;

  function close() {
    Keyboard.dismiss();
    onClose();
  }

  return (
    <Animated.View
      entering={isReducedMotion ? undefined : FadeIn.duration(150)}
      exiting={isReducedMotion ? undefined : FadeOut.duration(150)}
      className="mx-3 mt-1 mb-2 rounded-3xl bg-surface border border-border px-5 pt-3 pb-3"
    >
      <AppTextInput
        label="Keyword"
        value={search}
        onChangeText={onSearchChange}
        placeholder="Name, note, account or amount"
        autoCorrect={false}
        returnKeyType="search"
      />

      <AppLabel className="mt-2">Type</AppLabel>
      <AppChips chips={types} value={type} onChange={onTypeChange} accessibilityLabel="Filter activity" className="-mx-5" />

      <AppLabel className="mt-3">Category</AppLabel>
      <TouchableOpacity
        onPress={onPickCategory}
        activeOpacity={0.7}
        className="flex-row items-center gap-3 min-h-[60px] px-3 rounded-xl border border-border"
      >
        <View className={`w-[36px] h-[36px] rounded-xl items-center justify-center ${ICON_TONE.neutral.tile}`}>
          <Feather name={category?.icon ?? "grid"} size={17} color={ICON_TONE.neutral.glyph} />
        </View>
        <View className="flex-1">
          <AppText variant="body-bold" className="text-[14px]" numberOfLines={1}>
            {category?.name ?? "All categories"}
          </AppText>
          <AppText variant="meta">{category?.meta ?? "Income and expenses"}</AppText>
        </View>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <View className="flex-row items-center mt-4">
        {isFiltered && (
          <TouchableOpacity onPress={onClear} activeOpacity={0.7} className="min-h-[44px] justify-center pr-3">
            <AppText variant="body-bold" className="text-sm text-secondary">
              Clear all
            </AppText>
          </TouchableOpacity>
        )}
        <AppButton label="Done" onPress={close} className="ml-auto px-8" />
      </View>
    </Animated.View>
  );
}

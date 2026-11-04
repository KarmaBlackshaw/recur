import React from "react";
import { TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { AppSelectField } from "@/components/ui/AppSelectField";

interface ActivityFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  category?: string;
  // Opens the category sheet.
  onPickCategory: () => void;
  onClear: () => void;
}

// The panel Activity's filter toggle discloses: a keyword and a category, applied together.
export function ActivityFilters({ search, onSearchChange, category, onPickCategory, onClear }: ActivityFiltersProps) {
  const isReducedMotion = useReducedMotion();
  const isFiltered = search.trim() !== "" || category != null;
  return (
    <Animated.View
      entering={isReducedMotion ? undefined : FadeIn.duration(150)}
      exiting={isReducedMotion ? undefined : FadeOut.duration(150)}
      className="mx-5 -mt-1 mb-1"
    >
      <AppTextInput
        label="Keyword"
        value={search}
        onChangeText={onSearchChange}
        placeholder="Name, note, account or amount"
        autoCorrect={false}
        returnKeyType="search"
      />
      <AppSelectField
        label="Category"
        value={category ?? ""}
        placeholder="All categories"
        icon="chevron-down"
        onPress={onPickCategory}
      />
      {isFiltered && (
        <TouchableOpacity
          onPress={onClear}
          activeOpacity={0.7}
          className="self-end min-h-[44px] justify-center pl-3"
          accessibilityRole="button"
        >
          <AppText variant="body-bold" className="text-sm text-secondary">
            Clear filters
          </AppText>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

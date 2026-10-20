import React from "react";
import { ScrollView, TouchableOpacity } from "react-native";
import { AppText } from "@/components/ui/AppText";

interface AppSuggestionChipsProps {
  items: string[];
  onPick: (item: string) => void;
  accessibilityLabel: string;
}

export function AppSuggestionChips({ items, onPick, accessibilityLabel }: AppSuggestionChipsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      className="grow-0 shrink-0"
      contentContainerClassName="gap-2"
      accessibilityLabel={accessibilityLabel}
    >
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          className="items-center justify-center min-h-[44px] px-4 rounded-2xl border bg-surface border-border"
          onPress={() => onPick(item)}
          accessibilityRole="button"
          accessibilityLabel={`Use ${item}`}
        >
          <AppText variant="body-medium" className="text-sm text-textSecondary">
            {item}
          </AppText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

import React from "react";
import { View, TouchableOpacity } from "react-native";
import { AppText } from "@/components/ui/AppText";

interface Tab<T extends string | number> {
  label: string;
  value: T;
}

interface AppTabsProps<T extends string | number> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function AppTabs<T extends string | number>({ tabs, value, onChange, className = "" }: AppTabsProps<T>) {
  return (
    <View
      className={`flex-row bg-surface rounded-3xl border border-border p-1.5 ${className}`}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isSelected = value === tab.value;
        return (
          <TouchableOpacity
            key={tab.value}
            className={`flex-1 items-center justify-center min-h-[44px] px-1 rounded-[18px] ${
              isSelected ? "bg-primary/15" : ""
            }`}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isSelected }}
          >
            <AppText
              variant={isSelected ? "body-bold" : "body-medium"}
              className={`text-sm ${isSelected ? "text-secondary" : "text-textSecondary"}`}
            >
              {tab.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

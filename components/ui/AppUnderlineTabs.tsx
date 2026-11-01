import React from "react";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import type { TOption } from "@/types";

export interface TUnderlineTab<T extends string> extends TOption<T> {
  detail?: string;
}

interface AppUnderlineTabsProps<T extends string> {
  tabs: TUnderlineTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function AppUnderlineTabs<T extends string>({ tabs, value, onChange, className = "" }: AppUnderlineTabsProps<T>) {
  return (
    <View className={`flex-row border-b border-border ${className}`}>
      {tabs.map((tab) => {
        const isSelected = value === tab.value;
        const tone = isSelected ? "text-white" : "text-textMuted";
        return (
          <TouchableOpacity
            key={tab.value}
            className="flex-1 min-h-[44px] items-center justify-center px-2"
            onPress={() => onChange(tab.value)}
          >
            <AppText
              variant={isSelected ? "body-bold" : "body-medium"}
              className={`text-[13px] ${tone}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {tab.label}
              {tab.detail ? <AppText variant="amount-sm" className={`text-[14px] ${tone}`}>{`  ${tab.detail}`}</AppText> : null}
            </AppText>
            {isSelected ? <View className="absolute bottom-0 left-0 right-0 h-[2px] bg-secondary" /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

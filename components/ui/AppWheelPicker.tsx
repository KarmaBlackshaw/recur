// components/ui/AppWheelPicker.tsx
import React, { useEffect, useRef } from "react";
import { View, ScrollView, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { AppText } from "@/components/ui/AppText";
import type { TOption } from "@/types";

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PAD_ROWS = Math.floor(VISIBLE_ROWS / 2);

interface AppWheelPickerProps<T> {
  options: TOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  className?: string;
}

// ponytail: plain ScrollView — inside a bottom sheet, disable the sheet's content panning or the sheet steals the drag.
export function AppWheelPicker<T>({
  options,
  value,
  onChange,
  accessibilityLabel,
  className = "",
}: AppWheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.findIndex((opt) => opt.value === value));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  function selectIndex(index: number) {
    const clamped = Math.min(options.length - 1, Math.max(0, index));
    if (clamped !== selectedIndex) {
      onChange(options[clamped].value);
    }
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    selectIndex(Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT));
  }

  return (
    <View
      className={className}
      style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: options[selectedIndex]?.label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        selectIndex(selectedIndex + (nativeEvent.actionName === "increment" ? 1 : -1));
      }}
    >
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 rounded-xl bg-white/[0.06]"
        style={{ top: ITEM_HEIGHT * PAD_ROWS, height: ITEM_HEIGHT }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PAD_ROWS }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      >
        {options.map((opt, index) => (
          <View key={opt.label} className="items-center justify-center" style={{ height: ITEM_HEIGHT }}>
            <AppText
              variant={index === selectedIndex ? "body-bold" : "body-medium"}
              className={`text-xl ${index === selectedIndex ? "text-white" : "text-textMuted"}`}
            >
              {opt.label}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

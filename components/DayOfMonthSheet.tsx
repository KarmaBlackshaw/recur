import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { TouchableOpacity, View } from "react-native";
import { range } from "@/utils/collections";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppText } from "@/components/ui/AppText";
import { formatOrdinal } from "@/utils/dateHelpers";

export interface DayOfMonthSheetRef {
  present: () => void;
}

interface Props {
  title: string;
  value: number | null;
  onChange: (day: number) => void;
}

const DAYS = range(1, 32);
// No fixed snap points: the sheet sizes to the grid.
const CONTENT_HEIGHT_SNAP: string[] = [];

// Picks a day of the month (1–31). Tapping a day picks it and closes the sheet.
export const DayOfMonthSheet = forwardRef<DayOfMonthSheetRef, Props>(function DayOfMonthSheet(
  { title, value, onChange },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  function pick(day: number) {
    onChange(day);
    sheetRef.current?.dismiss();
  }

  return (
    <AppBottomSheet ref={sheetRef} title={title} snapPoints={CONTENT_HEIGHT_SNAP}>
      <View className="px-4 pb-4">
        <View className="flex-row flex-wrap">
          {DAYS.map((day) => {
            const isSelected = day === value;
            return (
              <View key={day} className="w-[14.28%] h-12 items-center justify-center">
                <TouchableOpacity
                  onPress={() => pick(day)}
                  className={`w-11 h-11 rounded-full items-center justify-center ${isSelected ? "bg-primary" : "bg-white/[0.04]"}`}
                  accessibilityRole="button"
                  accessibilityLabel={`The ${formatOrdinal(day)}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <AppText
                    variant={isSelected ? "body-bold" : "body-medium"}
                    className={`text-[15px] ${isSelected ? "text-white" : "text-textSecondary"}`}
                  >
                    {day}
                  </AppText>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        <AppText variant="caption" className="mt-3 px-1">
          Months without a 29th, 30th or 31st use their last day.
        </AppText>
      </View>
    </AppBottomSheet>
  );
});

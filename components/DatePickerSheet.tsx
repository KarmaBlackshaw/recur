import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppCalendar } from "@/components/ui/AppCalendar";
import { AppText } from "@/components/ui/AppText";

export interface DatePickerSheetRef {
  present: () => void;
}

interface Props {
  title: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

// No fixed snap points: the sheet sizes to the calendar.
const CONTENT_HEIGHT_SNAP: string[] = [];

export const DatePickerSheet = forwardRef<DatePickerSheetRef, Props>(function DatePickerSheet(
  { title, value, onChange, minimumDate, maximumDate },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  // Remount the calendar on every open so it starts on the selected month.
  const [openCount, setOpenCount] = useState(0);
  const today = dayjs().startOf("day");
  const isTodayAllowed =
    (minimumDate == null || !today.isBefore(minimumDate, "day")) &&
    (maximumDate == null || !today.isAfter(maximumDate, "day"));

  useImperativeHandle(ref, () => ({
    present: () => {
      setOpenCount((n) => n + 1);
      sheetRef.current?.present();
    },
  }));

  function pick(date: Date) {
    onChange(date);
    sheetRef.current?.dismiss();
  }

  const todayAction = isTodayAllowed ? (
    <TouchableOpacity
      onPress={() => pick(today.toDate())}
      className="min-h-[44px] justify-center px-2"
      accessibilityRole="button"
      accessibilityLabel="Pick today"
    >
      <AppText variant="body-bold" className="text-sm text-secondary">Today</AppText>
    </TouchableOpacity>
  ) : null;

  return (
    <AppBottomSheet ref={sheetRef} title={title} snapPoints={CONTENT_HEIGHT_SNAP} action={todayAction}>
      <View className="px-4 pb-4">
        <AppCalendar
          key={openCount}
          value={value}
          onChange={pick}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      </View>
    </AppBottomSheet>
  );
});

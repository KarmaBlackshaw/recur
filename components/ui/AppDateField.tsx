import React, { useRef } from "react";
import { Platform } from "react-native";
import dayjs from "dayjs";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { DatePickerSheet, type DatePickerSheetRef } from "@/components/DatePickerSheet";

interface Props {
  label: string;
  // ISO string; the field hands back the start of the picked day.
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  format?: string;
  caption?: string;
  error?: string;
}

// Android opens its native date dialog; iOS opens the app's calendar sheet (the native inline picker there is a
// second control to tap, not a picker).
export function AppDateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  format = "MMM D, YYYY",
  caption,
  error,
}: Props) {
  const sheetRef = useRef<DatePickerSheetRef>(null);
  const date = dayjs(value).toDate();
  const shown = dayjs(value).format(format);

  function pick(next: Date) {
    onChange(dayjs(next).startOf("day").toISOString());
  }

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        mode: "date",
        minimumDate,
        maximumDate,
        onValueChange: (_event, next) => pick(next),
      });
      return;
    }
    sheetRef.current?.present();
  }

  return (
    <>
      <AppSelectField
        label={label}
        value={shown}
        icon="calendar"
        onPress={open}
        caption={caption}
        error={error}
        accessibilityLabel={`${label}, ${dayjs(value).format("MMMM D, YYYY")}`}
        accessibilityHint="Opens a calendar"
      />
      {Platform.OS === "android" ? null : (
        <DatePickerSheet
          ref={sheetRef}
          title={label}
          value={date}
          onChange={pick}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </>
  );
}

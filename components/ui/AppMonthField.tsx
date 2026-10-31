import React, { useRef } from "react";
import dayjs from "dayjs";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { MonthPickerSheet, type MonthPickerSheetRef } from "@/components/MonthPickerSheet";

interface Props {
  label: string;
  // ISO string of any date in the month; the field hands back the first of the picked month.
  value: string;
  onChange: (iso: string) => void;
  minimumMonth?: Date;
  caption?: string;
  error?: string;
}

export function AppMonthField({ label, value, onChange, minimumMonth, caption, error }: Props) {
  const sheetRef = useRef<MonthPickerSheetRef>(null);
  const month = dayjs(value);
  return (
    <>
      <AppSelectField
        label={label}
        value={month.format("MMM YYYY")}
        icon="calendar"
        onPress={() => sheetRef.current?.present()}
        caption={caption}
        error={error}
        accessibilityLabel={`${label}, ${month.format("MMMM YYYY")}`}
        accessibilityHint="Opens a month picker"
      />
      <MonthPickerSheet
        ref={sheetRef}
        title={label}
        value={month.toDate()}
        minimumMonth={minimumMonth}
        onChange={(start) => onChange(start.toISOString())}
      />
    </>
  );
}

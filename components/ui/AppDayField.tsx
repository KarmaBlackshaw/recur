import React, { useRef } from "react";
import { AppSelectField } from "@/components/ui/AppSelectField";
import { DayOfMonthSheet, type DayOfMonthSheetRef } from "@/components/DayOfMonthSheet";
import { formatOrdinal } from "@/utils/dateHelpers";

interface Props {
  label: string;
  // Form value as text ("" when not set), so it slots into existing string-typed form fields.
  value: string;
  onChange: (value: string) => void;
  // Text shown for a picked day, e.g. (15) => "Every month on the 15th". Defaults to "The 15th".
  format?: (day: number) => string;
  placeholder?: string;
  caption?: string;
  error?: string;
}

export function AppDayField({
  label,
  value,
  onChange,
  format = (day) => `The ${formatOrdinal(day)}`,
  placeholder = "Pick a day",
  caption,
  error,
}: Props) {
  const sheetRef = useRef<DayOfMonthSheetRef>(null);
  const day = value.trim() === "" ? null : parseInt(value, 10);
  const isValidDay = day != null && day >= 1 && day <= 31;
  return (
    <>
      <AppSelectField
        label={label}
        value={isValidDay ? format(day) : ""}
        placeholder={placeholder}
        icon="calendar"
        onPress={() => sheetRef.current?.present()}
        caption={caption}
        error={error}
        accessibilityHint="Opens a day picker"
      />
      <DayOfMonthSheet
        ref={sheetRef}
        title={label}
        value={isValidDay ? day : null}
        onChange={(picked) => onChange(String(picked))}
      />
    </>
  );
}

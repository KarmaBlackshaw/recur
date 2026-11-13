import React from "react";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { DEFAULT_REMINDER, reminderOptionsFor } from "@/utils/reminders";

interface ReminderFieldProps {
  // The form value: "0" is off, empty is the default (a day before).
  value: string;
  onChange: (value: string) => void;
  // The saved lead time, so one the chips don't offer stays pickable.
  stored: number | null | undefined;
}

export function ReminderField({ value, onChange, stored }: ReminderFieldProps) {
  const shown = value.trim() === "" ? DEFAULT_REMINDER : value;
  return (
    <AppRadioGroup
      label="Reminder"
      options={reminderOptionsFor(stored)}
      value={shown}
      onChange={(next) => {
        if (next !== shown) {
          onChange(next);
        }
      }}
    />
  );
}

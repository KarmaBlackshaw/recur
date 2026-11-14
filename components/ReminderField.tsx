import React from "react";
import { View } from "react-native";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { AppText } from "@/components/ui/AppText";
import { DEFAULT_REMINDER, reminderOptionsFor } from "@/utils/reminders";

interface ReminderFieldProps {
  // The form value, the lead of the earlier reminder: "0" is none (the due day's only), empty is the default (a day before).
  value: string;
  onChange: (value: string) => void;
  // The saved lead time, so one the chips don't offer stays pickable.
  stored: number | null | undefined;
}

export function ReminderField({ value, onChange, stored }: ReminderFieldProps) {
  const shown = value.trim() === "" ? DEFAULT_REMINDER : value;
  return (
    <View>
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
      <AppText variant="meta" className="mt-1 mb-2">Days before the due date, plus one on the day</AppText>
    </View>
  );
}

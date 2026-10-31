// components/TimePickerSheet.tsx
import React, { forwardRef, useRef, useState } from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import { range } from "@/utils/collections";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppWheelPicker } from "@/components/ui/AppWheelPicker";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import type { TOption } from "@/types";

export interface TimePickerSheetRef {
  present: () => void;
}

interface Props {
  title: string;
  value: string;
  onChange: (time: string) => void;
}

type Period = "AM" | "PM";

const HOUR_OPTIONS = range(1, 13).map((hour) => ({ label: String(hour), value: hour }));
const MINUTE_OPTIONS = range(0, 60).map((minute) => ({ label: String(minute).padStart(2, "0"), value: minute }));
const PERIOD_OPTIONS: TOption<Period>[] = [
  { label: "AM", value: "AM" },
  { label: "PM", value: "PM" },
];
// ponytail: no fixed snap points, so the sheet sizes to its content (gorhom dynamic sizing).
const CONTENT_HEIGHT_SNAP: string[] = [];

function toDraft(time: string) {
  const parsed = dayjs(`2000-01-01T${time}`);
  const period: Period = parsed.hour() < 12 ? "AM" : "PM";
  return { hour: parsed.hour() % 12 || 12, minute: parsed.minute(), period };
}

export const TimePickerSheet = forwardRef<TimePickerSheetRef, Props>(function TimePickerSheet(
  { title, value, onChange },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const [draft, setDraft] = useState(() => toDraft(value));

  React.useImperativeHandle(ref, () => ({
    present: () => {
      setDraft(toDraft(value));
      sheetRef.current?.present();
    },
  }));

  function handleDone() {
    const hour24 = (draft.hour % 12) + (draft.period === "PM" ? 12 : 0);
    onChange(dayjs().hour(hour24).minute(draft.minute).format("HH:mm"));
    sheetRef.current?.dismiss();
  }

  return (
    <AppBottomSheet
      ref={sheetRef}
      title={title}
      snapPoints={CONTENT_HEIGHT_SNAP}
      enableContentPanningGesture={false}
    >
      <View className="flex-row items-center justify-center gap-2 px-4">
        <AppWheelPicker
          className="w-20"
          options={HOUR_OPTIONS}
          value={draft.hour}
          onChange={(hour) => setDraft((prev) => ({ ...prev, hour }))}
          accessibilityLabel="Hour"
        />
        <AppText variant="body-bold" className="text-xl text-white">:</AppText>
        <AppWheelPicker
          className="w-20"
          options={MINUTE_OPTIONS}
          value={draft.minute}
          onChange={(minute) => setDraft((prev) => ({ ...prev, minute }))}
          accessibilityLabel="Minute"
        />
        <AppWheelPicker
          className="w-20"
          options={PERIOD_OPTIONS}
          value={draft.period}
          onChange={(period) => setDraft((prev) => ({ ...prev, period }))}
          accessibilityLabel="AM or PM"
        />
      </View>
      <AppButton label="Done" className="mx-4 mt-4 mb-4" onPress={handleDone} />
    </AppBottomSheet>
  );
});

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import range from "lodash/range";
import { AppBottomSheet, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppWheelPicker } from "@/components/ui/AppWheelPicker";
import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";

export interface MonthPickerSheetRef {
  present: () => void;
}

interface Props {
  title: string;
  // Any date in the chosen month.
  value: Date;
  onChange: (monthStart: Date) => void;
  minimumMonth?: Date;
}

const MONTH_OPTIONS = range(12).map((month) => ({ label: dayjs(new Date(2000, month, 1)).format("MMMM"), value: month }));
const YEARS_BACK = 10;
const YEARS_AHEAD = 10;
// No fixed snap points: the sheet sizes to the wheels.
const CONTENT_HEIGHT_SNAP: string[] = [];

export const MonthPickerSheet = forwardRef<MonthPickerSheetRef, Props>(function MonthPickerSheet(
  { title, value, onChange, minimumMonth },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const [draft, setDraft] = useState({ year: value.getFullYear(), month: value.getMonth() });
  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(thisYear - YEARS_BACK, value.getFullYear(), minimumMonth?.getFullYear() ?? thisYear);
  const lastYear = Math.max(thisYear + YEARS_AHEAD, value.getFullYear());
  const yearOptions = range(firstYear, lastYear + 1).map((year) => ({ label: String(year), value: year }));
  const min = minimumMonth ? dayjs(minimumMonth).startOf("month") : null;
  const isTooEarly = min != null && dayjs(new Date(draft.year, draft.month, 1)).isBefore(min);

  useImperativeHandle(ref, () => ({
    present: () => {
      setDraft({ year: value.getFullYear(), month: value.getMonth() });
      sheetRef.current?.present();
    },
  }));

  function handleDone() {
    onChange(new Date(draft.year, draft.month, 1));
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
          className="w-40"
          options={MONTH_OPTIONS}
          value={draft.month}
          onChange={(month) => setDraft((prev) => ({ ...prev, month }))}
          accessibilityLabel="Month"
        />
        <AppWheelPicker
          className="w-24"
          options={yearOptions}
          value={draft.year}
          onChange={(year) => setDraft((prev) => ({ ...prev, year }))}
          accessibilityLabel="Year"
        />
      </View>
      {isTooEarly && min ? (
        <AppText variant="meta" className="text-overdue text-center mt-2" accessibilityLiveRegion="polite">
          {`Pick ${min.format("MMM YYYY")} or later`}
        </AppText>
      ) : null}
      <AppButton label="Done" className="mx-4 mt-4 mb-4" onPress={handleDone} disabled={isTooEarly} />
    </AppBottomSheet>
  );
});

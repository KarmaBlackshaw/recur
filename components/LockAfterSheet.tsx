import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppRadioGroup } from "@/components/ui/AppRadioGroup";
import { LOCK_AFTER_MINUTES } from "@/constants/appLock";
import { lockAfterLabel } from "@/utils/appLock/lockAfterLabel";
import type { TOption } from "@/types";

export interface LockAfterSheetRef {
  present: () => void;
}

interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

const OPTIONS: TOption<string>[] = LOCK_AFTER_MINUTES.map((minutes) => ({
  label: lockAfterLabel(minutes),
  value: String(minutes),
}));

export const LockAfterSheet = forwardRef<LockAfterSheetRef, Props>(function LockAfterSheet({ value, onChange }, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  function pick(picked: string) {
    sheetRef.current?.dismiss(() => onChange(Number(picked)));
  }

  return (
    <AppBottomSheet ref={sheetRef} title="Lock after" snapPoints={CONTENT_HEIGHT_SNAP}>
      <AppRadioGroup options={OPTIONS} value={String(value)} onChange={pick} className="px-4 mb-3" />
    </AppBottomSheet>
  );
});

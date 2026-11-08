import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";

export interface AppConfirmSheetRef {
  ask: () => Promise<boolean>;
}

interface Props {
  title: string;
  confirmLabel: string;
  children?: React.ReactNode;
}

export const AppConfirmSheet = forwardRef<AppConfirmSheetRef, Props>(function AppConfirmSheet(
  { title, confirmLabel, children },
  ref
) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const resolverRef = useRef<((isConfirmed: boolean) => void) | null>(null);
  const isConfirmedRef = useRef(false);

  function settle(isConfirmed: boolean) {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    isConfirmedRef.current = false;
    resolve?.(isConfirmed);
  }

  useImperativeHandle(ref, () => ({
    ask: () => {
      settle(false);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        sheetRef.current?.present();
      });
    },
  }));

  function confirm() {
    const resolve = resolverRef.current;
    isConfirmedRef.current = true;
    sheetRef.current?.dismiss(() => {
      if (resolverRef.current === resolve) {
        settle(true);
      }
    });
  }

  function handleDismiss() {
    if (!isConfirmedRef.current) {
      settle(false);
    }
  }

  return (
    <AppBottomSheet ref={sheetRef} title={title} snapPoints={CONTENT_HEIGHT_SNAP} onDismiss={handleDismiss}>
      <View className="px-4 pb-4">
        {children}
        <View className="mt-4 gap-2">
          <AppButton label={confirmLabel} onPress={confirm} />
          <AppButton label="Cancel" variant="ghost" onPress={() => sheetRef.current?.dismiss()} />
        </View>
      </View>
    </AppBottomSheet>
  );
});

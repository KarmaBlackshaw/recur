// components/ui/AppBottomSheet.tsx
import React, { forwardRef, useCallback, useRef } from "react";
import { View, TouchableOpacity, Keyboard } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

export interface AppBottomSheetRef {
  present: () => void;
  // A write that changes what the sheet shows runs in afterDismiss, once the sheet has closed: mid-close, gorhom 5.2.14
  // leaves a ghost portal and the next present() does nothing.
  dismiss: (afterDismiss?: () => void) => void;
}

const DEFAULT_SNAP_POINTS = ["60%", "85%"];

type Props = Omit<BottomSheetModalProps, "children"> & {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export const AppBottomSheet = forwardRef<AppBottomSheetRef, Props>(function AppBottomSheet(
  { title, action, children, snapPoints = DEFAULT_SNAP_POINTS, onDismiss, ...sheetProps },
  ref
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const afterDismissRef = useRef<(() => void) | null>(null);
  const { bottom } = useSafeAreaInsets();

  const runAfterDismiss = useCallback(() => {
    const afterDismiss = afterDismissRef.current;
    afterDismissRef.current = null;
    afterDismiss?.();
  }, []);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
    runAfterDismiss();
  }, [onDismiss, runAfterDismiss]);

  React.useImperativeHandle(ref, () => ({
    present: () => {
      runAfterDismiss();
      Keyboard.dismiss();
      sheetRef.current?.present();
    },
    dismiss: (afterDismiss) => {
      if (afterDismiss) {
        afterDismissRef.current = afterDismiss;
      }
      sheetRef.current?.dismiss();
    },
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      // gorhom makes the sheet one accessible element by default, which hides every control inside it from
      // VoiceOver / TalkBack.
      accessible={false}
      // A picker opened from a sheet stacks over it. gorhom's default "switch" minimizes the sheet below to restore it
      // later, but in 5.2.14 onChange overwrites the minimizing status before onClose reads it, so it is dismissed.
      stackBehavior="push"
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      {...sheetProps}
    >
      <BottomSheetView className="flex-1" style={{ paddingBottom: bottom }}>
        <View className="flex-row items-center justify-between mb-3 px-4">
          <AppText variant="title" accessibilityRole="header">{title}</AppText>
          <View className="flex-row gap-1">
            {action}
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center"
              onPress={() => sheetRef.current?.dismiss()}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

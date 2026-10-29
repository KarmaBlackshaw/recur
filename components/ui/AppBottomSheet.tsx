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
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

const DEFAULT_SNAP_POINTS = ["60%", "85%"];

type Props = Omit<BottomSheetModalProps, "children"> & {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export const AppBottomSheet = forwardRef<AppBottomSheetRef, Props>(function AppBottomSheet(
  { title, action, children, snapPoints = DEFAULT_SNAP_POINTS, ...sheetProps },
  ref
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { bottom } = useSafeAreaInsets();

  React.useImperativeHandle(ref, () => ({
    present: () => {
      Keyboard.dismiss();
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
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
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
      backdropComponent={renderBackdrop}
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

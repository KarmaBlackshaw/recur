// components/ui/AppSelectBottomSheet.tsx
import React, { forwardRef, useCallback, useMemo, useRef } from "react";
import { View, TouchableOpacity, FlatList } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { AppText } from "./AppText";

export interface AppSelectBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  title: string;
  items: string[];
  value: string;
  onChange: (item: string) => void;
  action?: React.ReactNode;
}

export const AppSelectBottomSheet = forwardRef<AppSelectBottomSheetRef, Props>(
  function AppSelectBottomSheet({ title, items, value, onChange, action }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["60%", "85%"], []);

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handleSelect = useCallback(
      (item: string) => {
        onChange(item);
        sheetRef.current?.dismiss();
      },
      [onChange]
    );

    const renderBackdrop = useCallback(
      (props: any) => (
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
        backgroundStyle={{ backgroundColor: "#1C1C1E" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView className="flex-1 px-4 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <AppText variant="heading" className="text-white text-lg">{title}</AppText>
            <View className="flex-row gap-1">
              {action}
              <TouchableOpacity
                className="p-1"
                onPress={() => sheetRef.current?.dismiss()}
              >
                <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item}
            numColumns={3}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`flex-1 m-1 py-3.5 px-1 rounded-xl border items-center justify-center ${
                  value === item
                    ? "bg-primary border-secondary"
                    : "bg-background border-white/10"
                }`}
                onPress={() => handleSelect(item)}
              >
                <AppText
                  variant={value === item ? "body-bold" : "body-medium"}
                  className={`text-xs text-center ${value === item ? "text-white" : "text-white/70"}`}
                  numberOfLines={1}
                >
                  {item}
                </AppText>
              </TouchableOpacity>
            )}
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

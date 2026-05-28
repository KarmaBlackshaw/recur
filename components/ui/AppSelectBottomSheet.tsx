// components/ui/AppSelectBottomSheet.tsx
import React, { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity, Keyboard } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

export interface AppSelectBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props<T> {
  title: string;
  items: T[];
  value: T;
  onChange: (item: T) => void;
  keyExtractor: (item: T) => string;
  renderItem: (item: T, selected: boolean, onSelect: () => void) => React.ReactNode;
  columns?: number;
  snapPoints?: string[];
  searchable?: boolean;
  getSearchKey?: (item: T) => string;
  action?: React.ReactNode;
}

export const AppSelectBottomSheet = forwardRef(function AppSelectBottomSheet<T>(
  {
    title,
    items,
    value,
    onChange,
    keyExtractor,
    renderItem,
    columns = 3,
    snapPoints: snapPointsProp,
    searchable = false,
    getSearchKey,
    action,
  }: Props<T>,
  ref: React.Ref<AppSelectBottomSheetRef>
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [search, setSearch] = useState("");
  const snapPoints = useMemo(() => snapPointsProp ?? ["60%", "85%"], [snapPointsProp]);

  React.useImperativeHandle(ref, () => ({
    present: () => {
      Keyboard.dismiss();
      if (searchable) setSearch("");
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return items;
    const q = search.trim().toLowerCase();
    const getKey = getSearchKey ?? keyExtractor;
    return items.filter((item) => getKey(item).toLowerCase().includes(q));
  }, [items, search, searchable, getSearchKey, keyExtractor]);

  const handleSelect = useCallback(
    (item: T) => {
      onChange(item);
      sheetRef.current?.dismiss();
    },
    [onChange]
  );

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
      backgroundStyle={{ backgroundColor: "#1C1C1E" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView className="flex-1 px-4">
        <View className="flex-row items-center justify-between mb-3">
          <AppText variant="heading" className="text-white text-lg">{title}</AppText>
          <View className="flex-row gap-1">
            {action}
            <TouchableOpacity className="p-1" onPress={() => sheetRef.current?.dismiss()}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>

        {searchable && (
          <AppTextInput
            className="mb-3"
            placeholder="Search…"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        <BottomSheetFlatList<T>
          data={filtered}
          keyExtractor={(item) => keyExtractor(item)}
          numColumns={columns}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) =>
            renderItem(item, keyExtractor(item) === keyExtractor(value), () => handleSelect(item)) as React.ReactElement
          }
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}) as <T>(props: Props<T> & { ref?: React.Ref<AppSelectBottomSheetRef> }) => React.ReactElement;

// components/ui/AppSelectBottomSheet.tsx
import React, { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity, Keyboard } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";
import { colors } from "../../constants/theme";

function EmptyItems({ searching }: { searching: boolean }) {
  return (
    <View className="flex-1 items-center justify-center py-12 gap-2">
      <Feather name={searching ? "search" : "inbox"} size={36} color="rgba(255,255,255,0.15)" />
      <AppText variant="body-medium" className="text-textMuted text-sm text-center">
        {searching ? "No results" : "Nothing here yet"}
      </AppText>
    </View>
  );
}

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
  onDismiss?: () => void;
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
    onDismiss,
  }: Props<T>,
  ref: React.Ref<AppSelectBottomSheetRef>
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [search, setSearch] = useState("");
  const snapPoints = useMemo(() => snapPointsProp ?? ["60%", "85%"], [snapPointsProp]);

  React.useImperativeHandle(ref, () => ({
    present: () => {
      Keyboard.dismiss();
      if (searchable) {
        setSearch("");
      }
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) {
      return items;
    }
    const q = search.trim().toLowerCase();
    const getKey = getSearchKey ?? keyExtractor;
    return items.filter((item) => getKey(item).toLowerCase().includes(q));
  }, [items, search, searchable, getSearchKey, keyExtractor]);

  const itemStyle = useMemo(
    () => ({ width: `${100 / columns}%` as const }),
    [columns]
  );
  const selectedKey = value != null ? keyExtractor(value) : null;

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
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.2)", width: 40 }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView className="flex-1">
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

        {searchable && (
          <AppTextInput
            className="mb-3 mx-4"
            placeholder="Search…"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        {filtered.length === 0 ? (
          <EmptyItems searching={searchable && search.trim().length > 0} />
        ) : (
          <BottomSheetScrollView keyboardShouldPersistTaps="handled">
            <View className="border-t border-border overflow-hidden pb-[200px]">
              <View className="flex-row flex-wrap items-start">
                {filtered.map((item) => {
                  const isSelected = keyExtractor(item) === selectedKey;
                  return (
                    <View
                      key={keyExtractor(item)}
                      className="border-r border-b border-border"
                      style={itemStyle}
                      accessibilityState={{ selected: isSelected }}
                    >
                      {renderItem(item, isSelected, () => handleSelect(item))}
                    </View>
                  );
                })}
                {Array.from({ length: (columns - (filtered.length % columns)) % columns }).map((_, i) => (
                  <View key={`__spacer_${i}`} className="border-r border-border" style={itemStyle} />
                ))}
              </View>
            </View>
          </BottomSheetScrollView>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}) as <T>(props: Props<T> & { ref?: React.Ref<AppSelectBottomSheetRef> }) => React.ReactElement;

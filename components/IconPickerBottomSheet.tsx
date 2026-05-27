import React, { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity, TextInput } from "react-native";
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { colors } from "../constants/theme";

const ALL_ICONS = Object.keys(Feather.glyphMap) as (keyof typeof Feather.glyphMap)[];

export interface IconPickerBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

export const IconPickerBottomSheet = forwardRef<IconPickerBottomSheetRef, Props>(
  function IconPickerBottomSheet({ value, onChange }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const [search, setSearch] = useState("");
    const snapPoints = useMemo(() => ["80%"], []);

    React.useImperativeHandle(ref, () => ({
      present: () => {
        setSearch("");
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const filtered = useMemo(
      () =>
        search.trim()
          ? ALL_ICONS.filter((name) =>
              name.includes(search.trim().toLowerCase())
            )
          : ALL_ICONS,
      [search]
    );

    const handleSelect = useCallback(
      (icon: keyof typeof Feather.glyphMap) => {
        onChange(icon as string);
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
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
              gap: 8,
            }}
          >
            <TextInput
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                color: "#fff",
                fontSize: 14,
              }}
              placeholder="Search icons…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={{ padding: 6 }}
              onPress={() => sheetRef.current?.dismiss()}
            >
              <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <BottomSheetFlatList
            data={filtered}
            keyExtractor={(item) => item}
            numColumns={5}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <TouchableOpacity
                  style={{
                    flex: 1,
                    margin: 4,
                    aspectRatio: 1,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected
                      ? "rgba(99,102,241,0.25)"
                      : "rgba(255,255,255,0.04)",
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.primary
                      : "rgba(255,255,255,0.06)",
                  }}
                  onPress={() => handleSelect(item)}
                >
                  <Feather
                    name={item}
                    size={22}
                    color={selected ? colors.secondary : "rgba(255,255,255,0.6)"}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </BottomSheetModal>
    );
  }
);

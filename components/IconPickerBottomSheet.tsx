import React, { forwardRef, useCallback } from "react";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AppSelectBottomSheet, AppSelectBottomSheetRef } from "./ui/AppSelectBottomSheet";
import { colors } from "../constants/theme";
import type { FeatherIconName } from "../types";

const ALL_ICONS = Object.keys(Feather.glyphMap) as FeatherIconName[];

export interface IconPickerBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  value: FeatherIconName;
  onChange: (icon: FeatherIconName) => void;
}

export const IconPickerBottomSheet = forwardRef<IconPickerBottomSheetRef, Props>(
  function IconPickerBottomSheet({ value, onChange }, ref) {
    const sheetRef = React.useRef<AppSelectBottomSheetRef>(null);

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const renderItem = useCallback(
      (item: FeatherIconName, selected: boolean, onSelect: () => void) => (
        <TouchableOpacity
          style={{
            flex: 1,
            margin: 4,
            aspectRatio: 1,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: selected ? colors.primary : "rgba(255,255,255,0.06)",
          }}
          onPress={onSelect}
        >
          <Feather
            name={item}
            size={22}
            color={selected ? colors.secondary : "rgba(255,255,255,0.6)"}
          />
        </TouchableOpacity>
      ),
      []
    );

    return (
      <AppSelectBottomSheet
        ref={sheetRef}
        title="Icon"
        items={ALL_ICONS}
        value={value}
        onChange={onChange}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        columns={5}
        snapPoints={["80%"]}
        searchable
      />
    );
  }
);

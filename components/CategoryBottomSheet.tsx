// components/CategoryBottomSheet.tsx
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TouchableOpacity, FlatList } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppText } from "./ui/AppText";
import { getAll } from "../db/categories";
import { colors } from "../constants/theme";

export interface CategoryBottomSheetRef {
  present: () => void;
}

interface Props {
  value: string;
  onChange: (category: string) => void;
}

export const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  function CategoryBottomSheet({ value, onChange }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["60%", "85%"], []);
    const [categories, setCategories] = useState<string[]>([]);

    useEffect(() => {
      getAll().then(setCategories);
    }, []);

    React.useImperativeHandle(ref, () => ({
      present: () => {
        getAll().then(setCategories);
        sheetRef.current?.present();
      },
    }));

    const handleSelect = useCallback(
      (cat: string) => {
        onChange(cat);
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
          {/* Header: title | edit + close */}
          <View className="flex-row items-center justify-between mb-4">
            <AppText variant="heading" className="text-white text-lg">Category</AppText>
            <View className="flex-row gap-1">
              <TouchableOpacity
                className="p-1"
                onPress={() => {
                  sheetRef.current?.dismiss();
                  router.push("/manage-categories");
                }}
              >
                <Feather name="edit-2" size={18} color={colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                className="p-1"
                onPress={() => sheetRef.current?.dismiss()}
              >
                <Feather name="x" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3-col grid */}
          <FlatList
            data={categories}
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

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import { PRESET_CATEGORIES } from "../utils/categories";
import { getCustom, insertCustom } from "../db/categories";
import { colors } from "../constants/theme";

interface Props {
  value: string;
  onChange: (category: string) => void;
}

export function CategoryPicker({ value, onChange }: Props) {
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    getCustom().then(setCustom);
  }, []);

  const allCategories = [...PRESET_CATEGORIES, ...custom];

  async function handleAddCustom() {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (allCategories.includes(trimmed)) {
      Alert.alert("Already exists");
      return;
    }
    await insertCustom(trimmed);
    setCustom((prev) => [...prev, trimmed]);
    onChange(trimmed);
    setNewCat("");
    setAdding(false);
  }

  return (
    <View className="gap-2">
      <FlatList
        data={allCategories}
        keyExtractor={(item) => item}
        numColumns={3}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`m-1 px-3 py-2 rounded-lg border flex-1 items-center ${
              value === item
                ? "bg-primary border-secondary"
                : "bg-surface border-border"
            }`}
            onPress={() => onChange(item)}
          >
            <Text
              className={`text-xs ${
                value === item
                  ? "text-white font-quicksand-bold"
                  : "text-white/70 font-quicksand-medium"
              }`}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          adding ? (
            <View className="flex-row m-1 gap-2">
              <TextInput
                className="flex-1 bg-surface border border-secondary rounded-lg px-3 py-2 text-white font-quicksand text-[13px]"
                value={newCat}
                onChangeText={setNewCat}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                maxLength={30}
                onSubmitEditing={handleAddCustom}
              />
              <TouchableOpacity
                onPress={handleAddCustom}
                className="bg-primary rounded-lg px-4 py-2 justify-center"
              >
                <Text className="text-white font-quicksand-bold text-[13px]">Add</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              className="m-1 px-3 py-2 rounded-lg border border-border bg-surface flex-1 items-center"
              onPress={() => setAdding(true)}
            >
              <Text className="text-white/70 font-quicksand-medium text-xs">+ Custom</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}

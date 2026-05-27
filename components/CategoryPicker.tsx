import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
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
    <View style={styles.container}>
      <FlatList
        data={allCategories}
        keyExtractor={(item) => item}
        numColumns={3}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, value === item && styles.chipSelected]}
            onPress={() => onChange(item)}
          >
            <Text style={[styles.chipText, value === item && styles.chipTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          adding ? (
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newCat}
                onChangeText={setNewCat}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                maxLength={30}
                onSubmitEditing={handleAddCustom}
              />
              <TouchableOpacity onPress={handleAddCustom} style={styles.addBtn}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.chip} onPress={() => setAdding(true)}>
              <Text style={styles.chipText}>+ Custom</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  chip: {
    margin: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    flex: 1,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.secondary,
  },
  chipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Quicksand_500Medium",
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Quicksand_700Bold",
  },
  addRow: {
    flexDirection: "row",
    margin: 4,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#FFFFFF",
    fontFamily: "Quicksand_400Regular",
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },
  addBtnText: {
    color: "#FFFFFF",
    fontFamily: "Quicksand_700Bold",
    fontSize: 13,
  },
});

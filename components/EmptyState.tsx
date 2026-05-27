import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

interface Props {
  onAdd?: () => void;
}

export function EmptyState({ onAdd }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="wallet-outline" size={64} color="rgba(255,255,255,0.15)" />
      <Text style={styles.title}>No expenses yet</Text>
      <Text style={styles.subtitle}>Tap + to add your first recurring expense</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  title: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    fontFamily: "Quicksand_700Bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    fontFamily: "Quicksand_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

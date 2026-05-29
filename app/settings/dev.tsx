import React from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { AppText } from "../../components/ui/AppText";
import { useExpenses } from "../../context/ExpenseContext";
import { seedTestData, clearAllData } from "../../db/seed";
import { colors } from "../../constants/theme";

export default function DevToolsScreen() {
  const { expenses, reloadAll } = useExpenses();

  async function handleSeed() {
    if (expenses.length === 0) {
      Alert.alert("No expenses", "Add at least one expense before seeding.");
      return;
    }
    await seedTestData(expenses);
    await reloadAll();
    Alert.alert("Done", "Seeded 3 months of test data.");
  }

  function handleClear() {
    Alert.alert("Clear all data", "This will delete all expenses and months. Cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearAllData();
          await reloadAll();
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity className="p-1" onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <AppText variant="heading" className="flex-1 text-center text-white text-xl">
          Dev Tools
        </AppText>
        <View style={{ width: 32 }} />
      </View>

      <View className="px-4 pt-2">
        <AppText variant="label" className="text-white/40 mb-2 pl-1">Actions</AppText>
        <View className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
          <TouchableOpacity
            className="flex-row items-center px-3.5 py-3 border-b border-border"
            onPress={handleSeed}
            accessibilityLabel="Seed test data"
          >
            <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
              <Feather name="database" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">Seed test data</AppText>
            <AppText variant="caption" className="text-white/35 mr-2 text-xs">3 months</AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-3.5 py-3"
            onPress={handleClear}
            accessibilityLabel="Clear all data"
          >
            <View className="w-8 h-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: colors.overdue }}>
              <Feather name="trash-2" size={15} color="#FFFFFF" />
            </View>
            <AppText variant="body-medium" className="flex-1 text-white text-sm">Clear all data</AppText>
            <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

import React, { useState } from "react";
import { RefreshControl } from "react-native";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { colors } from "@/constants/theme";

export function useRefreshControl() {
  const accounts = useAccounts();
  const expenses = useExpenses();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);
    try {
      await Promise.all([accounts.refresh(), expenses.reloadAll()]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  }

  return <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.text} colors={[colors.primary]} />;
}

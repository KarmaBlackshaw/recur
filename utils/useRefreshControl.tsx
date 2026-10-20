import React from "react";
import { RefreshControl } from "react-native";
import useRequest from "ahooks/es/useRequest";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { colors } from "@/constants/theme";

export function useRefreshControl() {
  const accounts = useAccounts();
  const expenses = useExpenses();
  const { loading, run } = useRequest(() => Promise.all([accounts.refresh(), expenses.reloadAll()]), { manual: true });
  return <RefreshControl refreshing={loading} onRefresh={run} tintColor={colors.text} colors={[colors.primary]} />;
}

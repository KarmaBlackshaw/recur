import React from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppFab } from "@/components/ui/AppFab";

// A borrower's pages sit outside the tabs, so the tab bar's add button never shows on them.
export function AddLoanFab({ borrower }: { borrower: string }) {
  const insets = useSafeAreaInsets();
  return (
    <AppFab
      icon="plus"
      className="absolute right-5"
      style={{ bottom: insets.bottom + 12 }}
      onPress={() => router.push({ pathname: "/loan/add", params: { borrower } })}
      accessibilityLabel={`Add loan for ${borrower}`}
      testID="add-loan-fab"
    />
  );
}

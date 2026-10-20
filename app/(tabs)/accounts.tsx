import React from "react";
import { View, FlatList, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAccounts } from "@/context/AccountContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { NetWorthHero } from "@/components/accounts/NetWorthHero";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { Account } from "@/types";

function openAddAccount() {
  router.push("/account/edit");
}

export default function AccountsScreen() {
  const { accounts, isLoading } = useAccounts();
  const refreshControl = useRefreshControl();
  const { fontScale } = useWindowDimensions();
  const numColumns = fontScale > 1.3 ? 1 : 2;
  const hasSpacer = numColumns === 2 && accounts.length % 2 === 1;
  const data: (Account | null)[] = hasSpacer ? [...accounts, null] : accounts;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between pl-5 pr-2 pt-2 pb-1">
        <AppText variant="display">Accounts</AppText>
        <TouchableOpacity
          onPress={openAddAccount}
          activeOpacity={0.7}
          className="size-11 items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Add account"
        >
          <Feather name="plus" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {accounts.length === 0 ? (
        <EmptyState
          onAdd={openAddAccount}
          actionLabel="Add account"
          title="No accounts yet"
          message="Add a bank account, wallet, or credit card to track your balances"
        />
      ) : (
        <FlatList
          key={numColumns}
          data={data}
          numColumns={numColumns}
          keyExtractor={(item) => item?.id ?? "spacer"}
          ListHeaderComponent={<NetWorthHero />}
          renderItem={({ item, index }) =>
            item ? <AccountCard account={item} index={index} /> : <View className="flex-1" />
          }
          columnWrapperClassName={numColumns === 2 ? "gap-3" : undefined}
          contentContainerClassName="gap-3 px-5 pt-2 pb-[140px]"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      )}
    </SafeAreaView>
  );
}

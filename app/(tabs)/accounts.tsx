import React from "react";
import { View, FlatList, TouchableOpacity, useWindowDimensions } from "react-native";
import useBoolean from "ahooks/es/useBoolean";
import chunk from "lodash/chunk";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAccounts } from "@/context/AccountContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { NetWorthHero } from "@/components/accounts/NetWorthHero";
import { BandHeader } from "@/components/BandHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { Account } from "@/types";

function openAddAccount() {
  router.push("/account/edit");
}

// Retired accounts, kept with their history. Collapsed by default so the grid stays about accounts in use.
function ArchivedAccounts({ accounts, numColumns }: { accounts: Account[]; numColumns: number }) {
  const [isOpen, { toggle }] = useBoolean(false);
  return (
    <View className="-mx-5">
      <BandHeader
        label="Archived"
        icon="archive"
        accent={colors.textMuted}
        count={accounts.length}
        isCollapsed={!isOpen}
        onToggle={toggle}
      />
      {isOpen &&
        chunk(accounts, numColumns).map((row) => (
          <View key={row[0].id} className="flex-row gap-3 px-5 mb-3">
            {row.map((account) => (
              <View key={account.id} className="flex-1 opacity-60">
                <AccountCard account={account} isCompact />
              </View>
            ))}
            {row.length < numColumns && <View className="flex-1" />}
          </View>
        ))}
    </View>
  );
}

export default function AccountsScreen() {
  const { accounts, activeAccounts, isLoading } = useAccounts();
  const archivedAccounts = accounts.filter((a) => a.archivedAt != null);
  const refreshControl = useRefreshControl();
  const { fontScale } = useWindowDimensions();
  const numColumns = fontScale > 1.3 ? 1 : 2;
  const hasSpacer = numColumns === 2 && activeAccounts.length % 2 === 1;
  const data: (Account | null)[] = hasSpacer ? [...activeAccounts, null] : activeAccounts;

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
          ListFooterComponent={
            archivedAccounts.length > 0 ? <ArchivedAccounts accounts={archivedAccounts} numColumns={numColumns} /> : null
          }
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

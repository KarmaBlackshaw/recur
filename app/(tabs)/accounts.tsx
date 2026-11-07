import React, { useState } from "react";
import { View, FlatList, TouchableOpacity, useWindowDimensions } from "react-native";
import { useBoolean } from "@/utils/useBoolean";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { groupAccountsByBank } from "@/utils/groupAccountsByBank";
import { getPreference, setPreference } from "@/db/preferences";
import { chunk } from "@/utils/collections";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useAccounts } from "@/context/AccountContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { NetWorthHero } from "@/components/accounts/NetWorthHero";
import { BandHeader } from "@/components/BandHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { colors } from "@/constants/theme";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { useHiddenAmounts } from "@/utils/useHiddenAmounts";
import type { Account, AccountBankGroup } from "@/types";

const GROUP_BY_BANK_PREFERENCE = "accountsGroupByBank";

function openAddAccount() {
  router.push("/account/edit");
}

function headerButtonClass(isOn: boolean) {
  return isOn
    ? "size-11 items-center justify-center rounded-full bg-primary/20"
    : "size-11 items-center justify-center rounded-full";
}

function AccountRows({
  accounts,
  numColumns,
  isDimmed = false,
  isAmountHidden,
}: {
  accounts: Account[];
  numColumns: number;
  isDimmed?: boolean;
  isAmountHidden: boolean;
}) {
  return chunk(accounts, numColumns).map((row) => (
    <View key={row[0].id} className="flex-row gap-3 px-5 mb-3">
      {row.map((account) => (
        <View key={account.id} className={isDimmed ? "flex-1 opacity-60" : "flex-1"}>
          <AccountCard account={account} isCompact={isDimmed} isAmountHidden={isAmountHidden} />
        </View>
      ))}
      {row.length < numColumns && <View className="flex-1" />}
    </View>
  ));
}

// Retired accounts, kept with their history. Collapsed by default so the grid stays about accounts in use.
function ArchivedAccounts({
  accounts,
  numColumns,
  isAmountHidden,
}: {
  accounts: Account[];
  numColumns: number;
  isAmountHidden: boolean;
}) {
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
      {isOpen && (
        <AccountRows accounts={accounts} numColumns={numColumns} isDimmed isAmountHidden={isAmountHidden} />
      )}
    </View>
  );
}

function BankGroup({
  group,
  numColumns,
  isAmountHidden,
}: {
  group: AccountBankGroup;
  numColumns: number;
  isAmountHidden: boolean;
}) {
  return (
    <View className="-mx-5">
      <BandHeader label={group.label} icon="credit-card" accent={colors.secondary} count={group.accounts.length} />
      <AccountRows accounts={group.accounts} numColumns={numColumns} isAmountHidden={isAmountHidden} />
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
  const [isGroupedByBank, setGroupedByBank] = useState(false);
  const [isAmountHidden, { toggle: toggleAmountHidden }] = useHiddenAmounts("accounts");

  useAsyncEffect(async function* () {
    const saved = await getPreference(GROUP_BY_BANK_PREFERENCE);
    yield;
    setGroupedByBank(saved === "true");
  }, []);

  async function toggleGroupByBank() {
    const next = !isGroupedByBank;
    setGroupedByBank(next);
    try {
      await setPreference(GROUP_BY_BANK_PREFERENCE, String(next));
    } catch (err) {
      console.error("Saving group by bank failed", err);
    }
  }

  const archivedFooter =
    archivedAccounts.length > 0 ? (
      <ArchivedAccounts accounts={archivedAccounts} numColumns={numColumns} isAmountHidden={isAmountHidden} />
    ) : undefined;
  const netWorthHero = <NetWorthHero isAmountHidden={isAmountHidden} />;

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
        {accounts.length > 0 && (
          <View className="flex-row items-center">
            <TouchableOpacity onPress={toggleAmountHidden} activeOpacity={0.7} className={headerButtonClass(!isAmountHidden)}>
              <Feather
                name={isAmountHidden ? "eye-off" : "eye"}
                size={22}
                color={isAmountHidden ? colors.text : colors.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleGroupByBank}
              activeOpacity={0.7}
              className={headerButtonClass(isGroupedByBank)}
              accessibilityRole="switch"
              accessibilityState={{ checked: isGroupedByBank }}
              accessibilityLabel="Group by bank"
            >
              <Feather name="layers" size={22} color={isGroupedByBank ? colors.secondary : colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {accounts.length === 0 ? (
        <EmptyState
          onAdd={openAddAccount}
          actionLabel="Add account"
          title="No accounts yet"
          message="Add a bank account, wallet, or credit card to track your balances"
        />
      ) : isGroupedByBank ? (
        <FlatList
          key="bank"
          data={groupAccountsByBank(activeAccounts)}
          keyExtractor={(group) => group.key}
          ListHeaderComponent={netWorthHero}
          ListFooterComponent={archivedFooter}
          extraData={isAmountHidden}
          renderItem={({ item }) => <BankGroup group={item} numColumns={numColumns} isAmountHidden={isAmountHidden} />}
          contentContainerClassName="px-5 pt-2 pb-[140px]"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      ) : (
        <FlatList
          key={numColumns}
          data={data}
          numColumns={numColumns}
          keyExtractor={(item) => item?.id ?? "spacer"}
          ListHeaderComponent={netWorthHero}
          ListFooterComponent={archivedFooter}
          extraData={isAmountHidden}
          renderItem={({ item, index }) =>
            item ? (
              <AccountCard account={item} index={index} isAmountHidden={isAmountHidden} />
            ) : (
              <View className="flex-1" />
            )
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

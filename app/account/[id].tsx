import React, { useEffect, useMemo, useRef } from "react";
import { Alert, SectionList, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import groupBy from "lodash/groupBy";
import orderBy from "lodash/orderBy";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { TransactionRow } from "@/components/accounts/TransactionRow";
import { AdjustBalanceSheet, type AdjustBalanceSheetRef } from "@/components/accounts/AdjustBalanceSheet";
import { TransferSheet, type TransferSheetRef } from "@/components/accounts/TransferSheet";
import { colors } from "@/constants/theme";
import { formatAmount, nextOccurrence } from "@/utils/dateHelpers";
import { signedAmount } from "@/utils/signedAmount";
import { ACCOUNT_TYPE_LABEL, type Account, type AccountTransaction, type FeatherIconName } from "@/types";

function ActionButton({ icon, label, onPress, disabled }: {
  icon: FeatherIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      className={`flex-1 min-h-[56px] rounded-xl bg-primary/15 items-center justify-center gap-1 ${disabled ? "opacity-40" : ""}`}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Feather name={icon} size={18} color={colors.secondary} />
      <AppText variant="body-bold" className="text-xs text-secondary">{label}</AppText>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value, isAlert }: { label: string; value: string; isAlert?: boolean }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <AppText variant="meta">{label}</AppText>
      <AppText variant="body-bold" className={`text-sm ${isAlert ? "text-overdue" : "text-white"}`}>{value}</AppText>
    </View>
  );
}

function BalanceHeader({ account, balance, interestPerMonth }: {
  account: Account;
  balance: number;
  interestPerMonth: number;
}) {
  const isCredit = account.type === "credit";
  const available = isCredit && account.creditLimit != null ? account.creditLimit - balance : null;
  const isAlert = isCredit ? available != null && available < 0 : balance < 0;
  const caption = isCredit ? "Owed" : "Balance";

  return (
    <View
      className={`mx-5 mb-4 rounded-2xl p-4 border ${isAlert ? "bg-overdue/[0.06] border-overdue/30" : "bg-surface border-border"}`}
      accessible
      accessibilityLabel={`${ACCOUNT_TYPE_LABEL[account.type]}, ${caption} ${signedAmount(balance)}${isAlert ? (isCredit ? ", over limit" : ", overdrawn") : ""}`}
    >
      <AppText variant="overline">{caption}</AppText>
      <View className="flex-row items-center gap-2 mt-1">
        {isAlert && <Feather name="alert-triangle" size={20} color={colors.overdue} />}
        <AppText
          variant="display"
          className={`text-[34px] ${isAlert && !isCredit ? "text-overdue" : "text-white"}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {signedAmount(balance)}
        </AppText>
      </View>
      {interestPerMonth > 0 && (
        <View className="flex-row items-center gap-1.5 mt-1">
          <Feather name="trending-up" size={14} color={colors.paid} />
          <AppText variant="meta" className="text-paid">+{formatAmount(interestPerMonth)}/mo net interest</AppText>
        </View>
      )}
      {isCredit && (
        <View className="mt-3 pt-2 border-t border-border">
          {account.creditLimit != null && <DetailRow label="Limit" value={formatAmount(account.creditLimit)} />}
          {available != null && (
            <DetailRow
              label={available < 0 ? "Over limit by" : "Available"}
              value={formatAmount(Math.abs(available))}
              isAlert={available < 0}
            />
          )}
          {account.statementDay != null && (
            <DetailRow label="Next statement" value={dayjs(nextOccurrence(account.statementDay)).format("MMM D")} />
          )}
          {account.dueDay != null && (
            <DetailRow label="Payment due" value={dayjs(nextOccurrence(account.dueDay)).format("MMM D")} />
          )}
        </View>
      )}
    </View>
  );
}

export default function AccountDetailScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: "adjust" | "transfer" }>();
  const accounts = useAccounts();
  const account = accounts.accounts.find((a) => a.id === id);
  const adjustRef = useRef<AdjustBalanceSheetRef>(null);
  const transferRef = useRef<TransferSheetRef>(null);
  const hasPresentedAction = useRef(false);
  const canTransfer = accounts.accounts.length > 1 && accounts.accounts.some((a) => a.type !== "credit");

  const sections = useMemo(() => {
    const own = orderBy(
      accounts.transactions.filter((t) => t.accountId === id),
      "createdAt",
      "desc"
    );
    return Object.entries(groupBy(own, (t) => dayjs(t.createdAt).format("YYYY-MM-DD"))).map(([key, data]) => ({
      key,
      date: dayjs(key).toDate(),
      data,
    }));
  }, [accounts.transactions, id]);

  useEffect(() => {
    if (!account || hasPresentedAction.current) {
      return;
    }
    hasPresentedAction.current = true;
    if (action === "adjust") {
      adjustRef.current?.present();
    }
    if (action === "transfer" && canTransfer) {
      transferRef.current?.present();
    }
  }, [account, action, canTransfer]);

  function confirmDeleteTransfer(transaction: AccountTransaction) {
    const { transferId } = transaction;
    if (!transferId) {
      return;
    }
    Alert.alert("Delete transfer?", "Both sides of this transfer are removed and the balances restored.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await accounts.deleteTransfer(transferId);
          } catch (e) {
            console.error("Delete transfer failed", e);
            Alert.alert("Delete failed", "Something went wrong. Please try again.");
          }
        },
      },
    ]);
  }

  if (!account) {
    return <SafeAreaView className="flex-1 bg-background" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-3 pt-2 pb-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <AppText variant="title" numberOfLines={1}>{account.name}</AppText>
          <AppText variant="caption">{ACCOUNT_TYPE_LABEL[account.type]}</AppText>
        </View>
        <View className="w-11" />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-12"
        ListHeaderComponent={
          <>
            <BalanceHeader
              account={account}
              balance={accounts.getBalance(account.id)}
              interestPerMonth={accounts.monthlyInterestEstimate(account)}
            />
            <View className="flex-row gap-3 px-5 mb-4">
              <ActionButton icon="sliders" label="Adjust" onPress={() => adjustRef.current?.present()} />
              <ActionButton
                icon="repeat"
                label="Transfer"
                onPress={() => transferRef.current?.present()}
                disabled={!canTransfer}
              />
              <ActionButton
                icon="edit-2"
                label="Edit"
                onPress={() => router.push({ pathname: "/account/edit", params: { id: account.id } })}
              />
            </View>
            <AppText variant="label" className="px-5 mb-1">Transactions</AppText>
          </>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="meta" className="px-5 pt-4 pb-1 text-textMuted" accessibilityRole="header">
            {dayjs(section.date).format("ddd, MMM D, YYYY")}
          </AppText>
        )}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            accountType={account.type}
            onPress={item.transferId ? () => confirmDeleteTransfer(item) : undefined}
          />
        )}
        ListEmptyComponent={
          <View className="items-center pt-10 px-8 gap-2">
            <Feather name="list" size={40} color={colors.textMuted} />
            <AppText variant="meta" className="text-center">
              No transactions yet. Payments, transfers and adjustments show up here.
            </AppText>
          </View>
        }
      />

      <AdjustBalanceSheet ref={adjustRef} account={account} />
      <TransferSheet ref={transferRef} account={account} />
    </SafeAreaView>
  );
}

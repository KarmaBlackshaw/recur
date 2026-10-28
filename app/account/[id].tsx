import React, { useEffect, useMemo, useRef } from "react";
import { Alert, SectionList, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { groupBy, orderBy } from "@/utils/collections";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { TransactionRow } from "@/components/accounts/TransactionRow";
import { AdjustBalanceSheet, type AdjustBalanceSheetRef } from "@/components/accounts/AdjustBalanceSheet";
import { AccountCard } from "@/components/accounts/AccountCard";
import { CardBillSheet, type CardBillSheetRef } from "@/components/accounts/CardBillSheet";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import { isBillTbd } from "@/utils/cardBills";
import { formatAmount, nextOccurrence } from "@/utils/dateHelpers";
import { useRefreshControl } from "@/utils/useRefreshControl";
import {
  ACCOUNT_TYPE_LABEL,
  type Account,
  type AccountTransaction,
  type CardBill,
  type FeatherIconName,
} from "@/types";

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

function DetailRow({ label, value, isAlert, onPress }: {
  label: string;
  value: string;
  isAlert?: boolean;
  onPress?: () => void;
}) {
  const valueText = (
    <AppText variant="body-bold" className={`text-sm ${isAlert ? "text-overdue" : "text-white"}`}>{value}</AppText>
  );
  if (!onPress) {
    return (
      <View className="flex-row justify-between py-1.5">
        <AppText variant="meta">{label}</AppText>
        {valueText}
      </View>
    );
  }
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-1.5"
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint="Opens the bill"
    >
      <AppText variant="meta">{label}</AppText>
      <View className="flex-row items-center gap-1">
        {valueText}
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function billState(bill: CardBill) {
  if (isBillTbd(bill)) {
    return "TBD";
  }
  if (bill.isPaid && bill.amount > 0) {
    return "Paid";
  }
  return bill.paid > 0 ? `${formatAmount(bill.remaining)} left` : formatAmount(bill.remaining);
}

function CreditDetails({ account, balance, dueBill, onDueBillPress }: {
  account: Account;
  balance: number;
  dueBill?: CardBill;
  onDueBillPress: () => void;
}) {
  const available = account.creditLimit != null ? account.creditLimit - balance : null;
  const isActive = account.archivedAt == null;
  const dueDate = account.dueDay != null ? dayjs(nextOccurrence(account.dueDay)).format("MMM D") : "";

  return (
    <View className="mx-5 mb-4 rounded-2xl px-4 py-2 bg-surface border border-border">
      {account.creditLimit != null && <DetailRow label="Limit" value={formatAmount(account.creditLimit)} />}
      {available != null && (
        <DetailRow
          label={available < 0 ? "Over limit by" : "Available"}
          value={formatAmount(Math.abs(available))}
          isAlert={available < 0}
        />
      )}
      {account.statementDay != null && isActive && (
        <DetailRow label="Next cut-off" value={dayjs(nextOccurrence(account.statementDay)).format("MMM D")} />
      )}
      {account.dueDay != null && isActive && (
        // Opens the bill from here too, so one set from Home (even to ₱0, which hides it there) stays editable.
        <DetailRow
          label="Payment due"
          value={dueBill ? `${dueDate} · ${billState(dueBill)}` : dueDate}
          onPress={dueBill ? onDueBillPress : undefined}
        />
      )}
    </View>
  );
}

export default function AccountDetailScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: "adjust" | "transfer" }>();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const account = accounts.accounts.find((a) => a.id === id);
  const isArchived = account?.archivedAt != null;
  const adjustRef = useRef<AdjustBalanceSheetRef>(null);
  const billSheetRef = useRef<CardBillSheetRef>(null);
  const hasPresentedAction = useRef(false);
  const isCredit = account?.type === "credit";
  const canTransfer =
    !isArchived && accounts.activeAccounts.length > 1 && accounts.activeAccounts.some((a) => a.type !== "credit");

  const openBill = useMemo(() => {
    if (!isCredit) {
      return undefined;
    }
    const now = dayjs();
    const next = now.add(1, "month");
    const bills = [...accounts.getCardBills(now.year(), now.month()), ...accounts.getCardBills(next.year(), next.month())]
      .filter((b) => b.account.id === id && !b.isPaid && b.remaining > 0);
    return orderBy(bills, "dueDate", "asc")[0];
  }, [accounts.getCardBills, id, isCredit]);

  const dueDay = account?.dueDay;
  const dueBill = useMemo(() => {
    if (!isCredit || isArchived || dueDay == null) {
      return undefined;
    }
    const due = dayjs(nextOccurrence(dueDay));
    return accounts.getCardBills(due.year(), due.month()).find((b) => b.account.id === id);
  }, [accounts.getCardBills, dueDay, id, isArchived, isCredit]);

  function openPayOrTransfer() {
    if (!account) {
      return;
    }
    if (!isCredit) {
      router.push({ pathname: "/transfer", params: { accountId: account.id } });
      return;
    }
    const params = openBill ? { id: account.id, amount: openBill.remaining.toFixed(2) } : { id: account.id };
    router.push({ pathname: "/account/pay", params });
  }

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
    if (action === "adjust" && !isArchived) {
      adjustRef.current?.present();
    }
    if (action === "transfer" && canTransfer) {
      openPayOrTransfer();
    }
  }, [account, action, canTransfer, isArchived]);

  async function handleUnarchive() {
    if (!account) {
      return;
    }
    try {
      await accounts.unarchiveAccount(account.id);
    } catch (e) {
      console.error("Unarchive account failed", e);
      Alert.alert("Unarchive failed", "Something went wrong. Please try again.");
    }
  }

  function confirmDeleteTransfer(transaction: AccountTransaction) {
    const { transferId } = transaction;
    if (!transferId) {
      return;
    }
    Alert.alert("Delete transfer?", "Both sides of this transfer and any fee or income recorded with it are removed, and the balances restored.", [
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
          <AppText variant="caption">
            {isArchived ? `${ACCOUNT_TYPE_LABEL[account.type]} · Archived` : ACCOUNT_TYPE_LABEL[account.type]}
          </AppText>
        </View>
        <View className="w-11" />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-12"
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <View className="flex-row px-5 mb-4">
              <AccountCard account={account} isStatic />
            </View>
            {account.type === "credit" && (
              <CreditDetails
                account={account}
                balance={accounts.getBalance(account.id)}
                dueBill={dueBill}
                onDueBillPress={() => dueBill && billSheetRef.current?.present(dueBill)}
              />
            )}
            {isArchived && (
              <AppText variant="meta" className="px-5 mb-3">
                Archived: it no longer shows up when you pick an account, and it has no bills or interest. Its
                history stays here.
              </AppText>
            )}
            <View className="flex-row gap-3 px-5 mb-4">
              {isArchived ? (
                <ActionButton icon="rotate-ccw" label="Unarchive" onPress={handleUnarchive} />
              ) : (
                <>
                  <ActionButton icon="sliders" label="Adjust" onPress={() => adjustRef.current?.present()} />
                  <ActionButton
                    icon={isCredit ? "credit-card" : "repeat"}
                    label={isCredit ? "Pay" : "Transfer"}
                    onPress={openPayOrTransfer}
                    disabled={!canTransfer}
                  />
                </>
              )}
              {account.id !== CASH_ACCOUNT_ID && (
                <ActionButton
                  icon="edit-2"
                  label="Edit"
                  onPress={() => router.push({ pathname: "/account/edit", params: { id: account.id } })}
                />
              )}
            </View>
            <AppLabel className="px-5">Transactions</AppLabel>
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
            onDelete={item.transferId ? () => confirmDeleteTransfer(item) : undefined}
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
      <CardBillSheet ref={billSheetRef} />
    </SafeAreaView>
  );
}

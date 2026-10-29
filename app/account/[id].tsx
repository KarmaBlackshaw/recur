import React, { useEffect, useMemo, useRef } from "react";
import { Alert, SectionList, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import groupBy from "lodash/groupBy";
import orderBy from "lodash/orderBy";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { useLoans } from "@/context/LoanContext";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { openExpense } from "@/components/ExpenseCard";
import { TransactionRow } from "@/components/accounts/TransactionRow";
import { AdjustBalanceSheet, type AdjustBalanceSheetRef } from "@/components/accounts/AdjustBalanceSheet";
import { CASH_ACCOUNT_ID } from "@/constants/accounts";
import { colors } from "@/constants/theme";
import { formatAmount, nextOccurrence } from "@/utils/dateHelpers";
import { signedAmount } from "@/utils/signedAmount";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { ACCOUNT_TYPE_LABEL, INTEREST_PERIOD_UNIT, type Account, type AccountTransaction, type FeatherIconName, type InterestEstimate } from "@/types";

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

function BalanceHeader({ account, balance, interest }: {
  account: Account;
  balance: number;
  interest: InterestEstimate | null;
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
      {interest && (
        <View className="flex-row items-center gap-1.5 mt-1">
          <Feather name="trending-up" size={14} color={colors.paid} />
          <AppText variant="meta" className="text-paid">+{formatAmount(interest.amount)}/{INTEREST_PERIOD_UNIT[interest.period].short} net interest</AppText>
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
          {account.statementDay != null && account.archivedAt == null && (
            <DetailRow label="Next cut-off" value={dayjs(nextOccurrence(account.statementDay)).format("MMM D")} />
          )}
          {account.dueDay != null && account.archivedAt == null && (
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
  const { expenses } = useExpenses();
  const loans = useLoans();
  const refreshControl = useRefreshControl();
  const account = accounts.accounts.find((a) => a.id === id);
  const isArchived = account?.archivedAt != null;
  const isCredit = account?.type === "credit";
  const adjustRef = useRef<AdjustBalanceSheetRef>(null);
  const hasPresentedAction = useRef(false);
  const canTransfer =
    !isArchived && accounts.activeAccounts.length > 1 && accounts.activeAccounts.some((a) => a.type !== "credit");
  const isTransferBlocked = !isArchived && !canTransfer;

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
      router.push({ pathname: "/transfer", params: { accountId: account.id } });
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

  function confirmDelete(title: string, message: string, remove: () => Promise<void>) {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await remove();
          } catch (e) {
            console.error("Delete transaction failed", e);
            Alert.alert("Delete failed", "Something went wrong. Please try again.");
          }
        },
      },
    ]);
  }

  // Tapping a row opens what it came from: the transfer, the income, the bill or the loan.
  function openHandlerFor(transaction: AccountTransaction): (() => void) | undefined {
    const { transferId, loanId, expenseId } = transaction;
    if (transferId && (transaction.kind === "transfer" || transaction.kind === "fee" || transaction.kind === "income")) {
      return () => router.push({ pathname: "/transfer", params: { id: transferId } });
    }
    if (transaction.kind === "income") {
      return () => router.push({ pathname: "/income/add", params: { id: transaction.id } });
    }
    if (transaction.kind === "payment") {
      const expense = expenseId != null ? expenses.find((e) => e.id === expenseId) : undefined;
      if (!expense) {
        return undefined;
      }
      const createdAt = dayjs(transaction.createdAt);
      return () =>
        openExpense(expense, transaction.cycleYear ?? createdAt.year(), transaction.cycleMonth ?? createdAt.month());
    }
    if (loanId && (transaction.kind === "loan_out" || transaction.kind === "loan_in")) {
      return () => router.push({ pathname: "/loan/[id]", params: { id: loanId } });
    }
    return undefined;
  }

  function deleteHandlerFor(transaction: AccountTransaction): (() => void) | undefined {
    const { transferId } = transaction;
    if (transferId) {
      return () =>
        confirmDelete(
          "Delete transfer?",
          "Both sides of this transfer and any fee or income recorded with it are removed, and the balances restored.",
          () => accounts.deleteTransfer(transferId)
        );
    }
    if (transaction.kind === "income") {
      return () =>
        confirmDelete("Delete income?", "This removes it and updates the account balance.", () =>
          accounts.deleteIncome(transaction.id)
        );
    }
    if (transaction.kind === "loan_in") {
      return () =>
        confirmDelete("Delete this payment?", "The balance will go back up.", () => loans.deletePayment(transaction.id));
    }
    return undefined;
  }

  if (!account) {
    return <SafeAreaView className="flex-1 bg-background" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title={account.name}
        subtitle={isArchived ? `${ACCOUNT_TYPE_LABEL[account.type]} · Archived` : ACCOUNT_TYPE_LABEL[account.type]}
      />

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-12"
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <BalanceHeader
              account={account}
              balance={accounts.getBalance(account.id)}
              interest={accounts.interestEstimate(account)}
            />
            {isArchived && (
              <AppText variant="meta" className="px-5 mb-3">
                Archived: it no longer shows up when you pick an account, and it has no bills or interest. Its
                history stays here.
              </AppText>
            )}
            <View className={`flex-row gap-3 px-5 ${isTransferBlocked ? "mb-2" : "mb-4"}`}>
              {isArchived ? (
                <ActionButton icon="rotate-ccw" label="Unarchive" onPress={handleUnarchive} />
              ) : (
                <>
                  <ActionButton icon="sliders" label="Adjust" onPress={() => adjustRef.current?.present()} />
                  <ActionButton
                    icon={isCredit ? "credit-card" : "repeat"}
                    label={isCredit ? "Pay bill" : "Transfer"}
                    onPress={() => router.push({ pathname: "/transfer", params: { accountId: account.id } })}
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
            {isTransferBlocked && (
              <AppText variant="meta" className="px-5 mb-3">
                {isCredit
                  ? "Add a bank or cash account to pay this card from."
                  : "Add another account to move money between them."}
              </AppText>
            )}
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
            onPress={openHandlerFor(item)}
            onDelete={deleteHandlerFor(item)}
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
    </SafeAreaView>
  );
}

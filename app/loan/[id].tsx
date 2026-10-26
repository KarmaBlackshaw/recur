import React, { useMemo } from "react";
import { Alert, SectionList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { groupBy, orderBy } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppButton } from "@/components/ui/AppButton";
import { LoadingState } from "@/components/ui/LoadingState";
import { LoanHistoryRow, type TLoanHistoryItem } from "@/components/loans/LoanHistoryRow";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/dateHelpers";
import { formatLoanAge } from "@/utils/loans/formatLoanAge";
import { formatLoanInterest } from "@/utils/loans/formatLoanInterest";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { AccountTransaction } from "@/types";

const KIND_RANK: Record<TLoanHistoryItem["kind"], number> = { lent: 0, interest: 1, payment: 2 };

const HERO_STYLE = {
  active: { overline: "Still owed", box: "bg-secondary/10 border-secondary/20", amount: "text-secondary" },
  settled: { overline: "Collected", box: "bg-paid/10 border-paid/20", amount: "text-paid" },
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between px-5 py-1.5">
      <AppText variant="meta">{label}</AppText>
      <AppText variant="body-medium">{value}</AppText>
    </View>
  );
}

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loans = useLoans();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const loan = loans.loans.find((l) => l.id === id);
  const summary = loan ? loans.summaries[loan.id] : undefined;

  const sections = useMemo(() => {
    if (!loan || !summary) {
      return [];
    }
    const nameOf = (accountId: string) => accounts.accounts.find((a) => a.id === accountId)?.name;
    const items: TLoanHistoryItem[] = [
      { key: "lent", kind: "lent", date: loan.lentAt, amount: loan.principal, accountName: nameOf(loan.accountId) },
      ...summary.charges.map(({ date, amount }, index): TLoanHistoryItem => ({
        key: `interest-${index}`,
        kind: "interest",
        date,
        amount,
        accountName: undefined,
      })),
      ...loans.paymentsOf(loan.id).map((txn): TLoanHistoryItem => ({
        key: txn.id,
        kind: "payment",
        date: txn.createdAt,
        amount: Math.abs(txn.amount),
        accountName: nameOf(txn.accountId),
        txn,
      })),
    ];
    const newestFirst = orderBy(
      items,
      [(item) => dayjs(item.date).format("YYYY-MM-DD"), (item) => KIND_RANK[item.kind], "date"],
      ["desc", "desc", "desc"]
    );
    return Object.entries(groupBy(newestFirst, (item) => dayjs(item.date).format("YYYY-MM-DD"))).map(([key, data]) => ({
      key,
      date: dayjs(key).toDate(),
      data,
    }));
  }, [loan, summary, loans.paymentsOf, accounts.accounts]);

  function confirmDeletePayment(txn: AccountTransaction) {
    Alert.alert("Delete this payment?", "The balance will go back up.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await loans.deletePayment(txn.id);
          } catch (e) {
            console.error("Delete payment failed", e);
            Alert.alert("Delete failed", "Something went wrong. Please try again.");
          }
        },
      },
    ]);
  }

  function renderItem({ item }: { item: TLoanHistoryItem }) {
    const onPress = item.kind === "payment" ? () => confirmDeletePayment(item.txn) : undefined;
    return <LoanHistoryRow item={item} onPress={onPress} />;
  }

  function renderSectionHeader({ section }: { section: { date: Date } }) {
    return (
      <AppText variant="meta" className="px-5 pt-4 pb-1 text-textMuted" accessibilityRole="header">
        {dayjs(section.date).format("ddd, MMM D, YYYY")}
      </AppText>
    );
  }

  if (loans.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!loan || !summary) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">This loan no longer exists.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const hero = summary.isSettled ? HERO_STYLE.settled : HERO_STYLE.active;
  const endDate = summary.settledAt ?? dayjs().format("YYYY-MM-DD");
  const meta = `Lent ${formatAmount(loan.principal)} · ${dayjs(loan.lentAt).format("MMM D")} · ${formatLoanAge(loan.lentAt, endDate)}`;

  const heroAmount = summary.isSettled ? summary.paidTotal : summary.balance;
  const interestLabel = formatLoanInterest(loan.interest);
  const heroA11yLabel = `${hero.overline} ${formatAmount(heroAmount)}. ${meta}. ${interestLabel}`;

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
          <AppText variant="title" numberOfLines={1}>{loan.borrower}</AppText>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/loan/add", params: { id: loan.id } })}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Edit loan"
        >
          <Feather name="edit-2" size={20} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-12"
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <View
              className={`mx-5 mt-3 mb-1 rounded-2xl border p-5 ${hero.box}`}
              accessible
              accessibilityLabel={heroA11yLabel}
            >
              <AppText variant="overline">{hero.overline}</AppText>
              <Text
                className={`text-[32px] font-oswald-medium mt-1 ${hero.amount}`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.4}
              >
                {formatAmount(heroAmount)}
              </Text>
              <AppText variant="meta" className="mt-1">{meta}</AppText>
              <AppText variant="meta">{interestLabel}</AppText>
            </View>
            <StatRow label="Interest so far" value={formatAmount(summary.interestTotal)} />
            <StatRow label="Paid so far" value={formatAmount(summary.paidTotal)} />
            {!summary.isSettled && (
              <AppButton label="Record payment" className="mx-5 mt-3" onPress={() => router.push({ pathname: "/loan/pay", params: { id: loan.id } })} />
            )}
            <AppLabel className="px-5">History</AppLabel>
          </>
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

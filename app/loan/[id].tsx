import React, { useMemo } from "react";
import { Alert, SectionList, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { groupBy, orderBy } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AppHeroCard, type HeroTone } from "@/components/ui/AppHeroCard";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppButton } from "@/components/ui/AppButton";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { LoanHistoryRow, type TLoanHistoryItem } from "@/components/loans/LoanHistoryRow";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import { formatLoanAge } from "@/utils/loans/formatLoanAge";
import { formatLoanInterest } from "@/utils/loans/formatLoanInterest";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { AccountTransaction } from "@/types";

const KIND_RANK: Record<TLoanHistoryItem["kind"], number> = { lent: 0, interest: 1, payment: 2 };

const HERO: Record<"active" | "settled", { overline: string; tone: HeroTone }> = {
  active: { overline: "Still owed", tone: "secondary" },
  settled: { overline: "Collected", tone: "paid" },
};

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
    const overpaidBy = new Map(summary.overpayments.map(({ payment, amount }) => [payment.id, amount]));
    const items: TLoanHistoryItem[] = [
      {
        key: "lent",
        kind: "lent",
        isLentBeforeRecur: loan.accountId == null,
        date: loan.lentAt,
        amount: loan.principal,
        accountName: loan.accountId == null ? undefined : nameOf(loan.accountId),
      },
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
        overpaid: overpaidBy.get(txn.id),
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
            alertFailure("Delete failed", e);
          }
        },
      },
    ]);
  }

  function renderItem({ item }: { item: TLoanHistoryItem }) {
    if (item.kind !== "payment" || !loan) {
      return <LoanHistoryRow item={item} />;
    }
    const { txn } = item;
    return (
      <LoanHistoryRow
        item={item}
        onPress={() => router.push({ pathname: "/loan/pay", params: { id: loan.id, paymentId: txn.id } })}
        onDelete={() => confirmDeletePayment(txn)}
      />
    );
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

  const hero = summary.isSettled ? HERO.settled : HERO.active;
  const endDate = summary.settledAt ?? dayjs().format("YYYY-MM-DD");
  const meta = `Lent ${formatAmount(loan.principal)} · ${dayjs(loan.lentAt).format("MMM D")} · ${formatLoanAge(loan.lentAt, endDate)}`;

  const heroAmount = summary.isSettled ? summary.paidTotal : summary.balance;
  const interestLabel = formatLoanInterest(loan.interest);
  const heroA11yLabel = [`${hero.overline} ${formatAmount(heroAmount)}`, meta, interestLabel, loan.note]
    .filter(Boolean)
    .join(". ");

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title={loan.borrower}
        right={
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/loan/add", params: { id: loan.id } })}
            className="w-11 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Edit loan"
          >
            <Feather name="edit-2" size={20} color={colors.secondary} />
          </TouchableOpacity>
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-12"
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <AppHeroCard
              overline={hero.overline}
              value={formatAmount(heroAmount)}
              tone={hero.tone}
              className="mx-5 mt-3 mb-1"
              accessible
              accessibilityLabel={heroA11yLabel}
            >
              <AppText variant="meta" className="mt-1">{meta}</AppText>
              <AppText variant="meta">{interestLabel}</AppText>
              {loan.note ? <AppText className="mt-2">{loan.note}</AppText> : null}
            </AppHeroCard>
            <View className="px-5">
              <AppDetailRow label="Interest so far" value={formatAmount(summary.interestTotal)} />
              <AppDetailRow label="Paid so far" value={formatAmount(summary.paidTotal)} />
            </View>
            {!summary.isSettled && (
              <AppButton label="Record payment" className="mx-5 mt-3" onPress={() => router.push({ pathname: "/loan/pay", params: { id: loan.id } })} />
            )}
            <AppLabel className="px-5 mt-6">History</AppLabel>
          </>
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

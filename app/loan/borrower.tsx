import React, { useMemo } from "react";
import { SectionList } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { sumBy, orderBy, partition } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { AppText } from "@/components/ui/AppText";
import { AppHeroCard, type HeroTone } from "@/components/ui/AppHeroCard";
import { AppButton } from "@/components/ui/AppButton";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppFab } from "@/components/ui/AppFab";
import { LoadingState } from "@/components/ui/LoadingState";
import { LoanRow } from "@/components/loans/LoanRow";
import { RepaymentRow } from "@/components/loans/RepaymentRow";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import { loanTitle } from "@/utils/loans/loanTitle";
import { useRevertRepayment } from "@/utils/loans/useRevertRepayment";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { Loan, TRepayment } from "@/types";

type TBorrowerRow =
  | { kind: "loan"; key: string; loan: Loan }
  | { kind: "repayment"; key: string; repayment: TRepayment };

export default function BorrowerLoansScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const loans = useLoans();
  const revertRepayment = useRevertRepayment();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const insets = useSafeAreaInsets();
  const today = dayjs().format("YYYY-MM-DD");

  const { active, settled } = useMemo(() => {
    const own = loans.loans.filter(({ borrower }) => borrower === name);
    const [settledLoans, activeLoans] = partition(own, ({ id }) => loans.summaries[id]?.isSettled === true);
    return {
      active: orderBy(activeLoans, "lentAt", "asc"),
      settled: orderBy(settledLoans, ({ id }) => loans.summaries[id]?.settledAt ?? "", "desc"),
    };
  }, [loans.loans, loans.summaries, name]);

  const payments = useMemo(
    () => loans.repayments.filter(({ borrower }) => borrower === name),
    [loans.repayments, name]
  );

  if (accounts.isLoading || loans.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (active.length + settled.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">No loans for this person.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const isAllSettled = active.length === 0;
  const heroAmount = isAllSettled
    ? sumBy(settled, ({ id }) => loans.summaries[id]?.paidTotal ?? 0)
    : sumBy(active, ({ id }) => loans.summaries[id]?.balance ?? 0);
  const hero: { overline: string; tone: HeroTone } = isAllSettled
    ? { overline: "Collected", tone: "paid" }
    : { overline: "Owes you", tone: "secondary" };
  const meta = `${active.length} active · ${settled.length} settled`;
  const sections: { title: string; data: TBorrowerRow[] }[] = [
    { title: "Active", data: active.map((loan): TBorrowerRow => ({ kind: "loan", key: loan.id, loan })) },
    { title: "Settled", data: settled.map((loan): TBorrowerRow => ({ kind: "loan", key: loan.id, loan })) },
    {
      title: "Payments",
      data: payments.map((repayment): TBorrowerRow => ({
        kind: "repayment",
        key: `repayment:${repayment.id}`,
        repayment,
      })),
    },
  ].filter(({ data }) => data.length > 0);

  function recordPayment() {
    if (active.length === 1) {
      router.push({ pathname: "/loan/pay", params: { id: active[0].id } });
      return;
    }
    router.push({ pathname: "/loan/pay", params: { borrower: name } });
  }

  function renderItem({ item }: { item: TBorrowerRow }) {
    if (item.kind === "repayment") {
      return <RepaymentRow repayment={item.repayment} onRevert={() => revertRepayment(item.repayment)} />;
    }
    const { loan } = item;
    const summary = loans.summaries[loan.id];
    if (!summary) {
      return null;
    }
    return (
      <LoanRow
        loan={loan}
        summary={summary}
        accountName={accounts.accounts.find(({ id }) => id === loan.accountId)?.name}
        today={today}
        title={loanTitle(loan)}
        onPress={() => router.push({ pathname: "/loan/[id]", params: { id: loan.id } })}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title={name} />

      <SectionList
        sections={sections}
        keyExtractor={({ key }) => key}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-[96px]"
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <AppHeroCard
              overline={hero.overline}
              value={formatAmount(heroAmount)}
              tone={hero.tone}
              className="mx-5 mt-3 mb-1"
              accessible
              accessibilityLabel={`${hero.overline} ${formatAmount(heroAmount)}. ${meta}`}
            >
              <AppText variant="meta">{meta}</AppText>
            </AppHeroCard>
            {!isAllSettled && <AppButton label="Record payment" className="mx-5 mt-3" onPress={recordPayment} />}
          </>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="meta" className="px-5 pt-4 pb-1 text-textMuted" accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={renderItem}
      />

      <AppFab
        icon="plus"
        className="absolute right-5"
        style={{ bottom: insets.bottom + 12 }}
        onPress={() => router.push({ pathname: "/loan/add", params: { borrower: name } })}
        accessibilityLabel={`Add loan for ${name}`}
      />
    </SafeAreaView>
  );
}

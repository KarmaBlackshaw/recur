import React, { useMemo } from "react";
import { FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { AppTabs } from "@/components/ui/AppTabs";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { AddLoanFab } from "@/components/loans/AddLoanFab";
import { LoanRow } from "@/components/loans/LoanRow";
import { RepaymentRow } from "@/components/loans/RepaymentRow";
import { colors } from "@/constants/theme";
import { formatAmount } from "@/utils/formatAmount";
import { loanTitle } from "@/utils/loans/loanTitle";
import { useRevertRepayment } from "@/utils/loans/useRevertRepayment";
import { useRefreshControl } from "@/utils/useRefreshControl";
import type { Loan, TOption, TRepayment } from "@/types";

type Tab = "active" | "settled" | "payments";

type TBorrowerRow =
  | { kind: "loan"; key: string; loan: Loan }
  | { kind: "repayment"; key: string; repayment: TRepayment };

const TABS: TOption<Tab>[] = [
  { label: "Active", value: "active" },
  { label: "Settled", value: "settled" },
  { label: "Payments", value: "payments" },
];

const EMPTY_STATE: Record<Tab, React.ReactElement> = {
  active: <EmptyState icon="users" title="No active loans" message="Tap + to lend money" />,
  settled: <EmptyState icon="check-circle" title="Nothing settled yet" message="Paid-off loans show up here" />,
  payments: <EmptyState icon="arrow-down-left" title="No payments yet" message="Payments you record show up here" />,
};

export default function BorrowerLoansScreen() {
  const params = useLocalSearchParams<{ name: string; tab?: Tab }>();
  const { name } = params;
  const loans = useLoans();
  const revertRepayment = useRevertRepayment();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
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
        <AddLoanFab borrower={name} />
      </SafeAreaView>
    );
  }

  const isAllSettled = active.length === 0;
  const tab = TABS.find(({ value }) => value === params.tab)?.value ?? (isAllSettled ? "settled" : "active");
  const heroAmount = isAllSettled
    ? sumBy(settled, ({ id }) => loans.summaries[id]?.paidTotal ?? 0)
    : sumBy(active, ({ id }) => loans.summaries[id]?.balance ?? 0);
  const hero: { overline: string; tone: HeroTone } = isAllSettled
    ? { overline: "Collected", tone: "paid" }
    : { overline: "Owes you", tone: "secondary" };
  const rows: Record<Tab, TBorrowerRow[]> = {
    active: active.map((loan) => ({ kind: "loan", key: loan.id, loan })),
    settled: settled.map((loan) => ({ kind: "loan", key: loan.id, loan })),
    payments: payments.map((repayment) => ({ kind: "repayment", key: `repayment:${repayment.id}`, repayment })),
  };
  const tabs = TABS.map((option) => ({ ...option, label: `${option.label} · ${rows[option.value].length}` }));

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
        today={today}
        title={loanTitle(loan)}
        onPress={() => router.push({ pathname: "/loan/[id]", params: { id: loan.id } })}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader title={name} />

      <FlatList
        data={rows[tab]}
        keyExtractor={({ key }) => key}
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
              accessibilityLabel={`${hero.overline} ${formatAmount(heroAmount)}`}
            />
            {!isAllSettled && <AppButton label="Record payment" className="mx-5 mt-3" onPress={recordPayment} />}
            <AppTabs
              tabs={tabs}
              value={tab}
              onChange={(next) => router.setParams({ tab: next })}
              className="mx-5 mt-4 mb-1"
            />
          </>
        }
        ListEmptyComponent={EMPTY_STATE[tab]}
        renderItem={renderItem}
      />

      <AddLoanFab borrower={name} />
    </SafeAreaView>
  );
}

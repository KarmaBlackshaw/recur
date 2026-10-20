import React, { useMemo } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import sumBy from "lodash/sumBy";
import orderBy from "lodash/orderBy";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { LoanRow } from "@/components/loans/LoanRow";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { AppChips } from "@/components/ui/AppChips";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { formatAmount } from "@/utils/dateHelpers";
import type { Loan } from "@/types";

type Segment = "active" | "settled";

const SEGMENTS: { label: string; value: Segment }[] = [
  { label: "Active", value: "active" },
  { label: "Settled", value: "settled" },
];

const HERO: Record<Segment, { overline: string; box: string; text: string }> = {
  active: { overline: "Owed to you", box: "bg-secondary/10 border-secondary/20", text: "text-secondary" },
  settled: { overline: "Collected", box: "bg-paid/10 border-paid/20", text: "text-paid" },
};

const EMPTY_STATE: Record<Segment, React.ReactElement> = {
  active: (
    <EmptyState
      icon="users"
      title="No active loans"
      message="Tap + to lend money"
      actionLabel="New loan"
      onAdd={() => router.push("/loan/add")}
    />
  ),
  settled: <EmptyState icon="check-circle" title="Nothing settled yet" message="Paid-off loans show up here" />,
};

function countLabel(count: number, singular: string) {
  return `${count} ${singular} loan${count === 1 ? "" : "s"}`;
}

export default function LoansScreen() {
  const loans = useLoans();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const segment = SEGMENTS.find(({ value }) => value === params.segment)?.value ?? "active";
  const today = dayjs().format("YYYY-MM-DD");

  const { active, settled } = useMemo(() => {
    const isSettled = ({ id }: Loan) => loans.summaries[id]?.isSettled === true;
    return {
      active: orderBy(
        loans.loans.filter((loan) => !isSettled(loan)),
        "lentAt",
        "asc"
      ),
      settled: orderBy(loans.loans.filter(isSettled), ({ id }) => loans.summaries[id]?.settledAt ?? "", "desc"),
    };
  }, [loans.loans, loans.summaries]);

  if (accounts.isLoading || loans.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  const data: Record<Segment, Loan[]> = { active, settled };
  const entries = data[segment];
  const hero = HERO[segment];
  const totals: Record<Segment, number> = {
    active: sumBy(active, ({ id }) => loans.summaries[id]?.balance ?? 0),
    settled: sumBy(settled, ({ id }) => loans.summaries[id]?.paidTotal ?? 0),
  };
  const heroMeta: Record<Segment, string> = {
    active: active.length > 0 ? countLabel(active.length, "active") : "No active loans",
    settled: countLabel(settled.length, "settled"),
  };

  const renderItem = ({ item }: { item: Loan }) => {
    const summary = loans.summaries[item.id];
    if (!summary) {
      return null;
    }
    return (
      <LoanRow
        loan={item}
        summary={summary}
        accountName={accounts.accounts.find(({ id }) => id === item.accountId)?.name}
        today={today}
        onPress={() => router.push({ pathname: "/loan/[id]", params: { id: item.id } })}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between pl-5 pr-2 pt-2 pb-1">
        <AppText variant="display">Loans</AppText>
      </View>

      <AppChips
        chips={SEGMENTS}
        value={segment}
        onChange={(next) => router.setParams({ segment: next })}
        accessibilityLabel="Filter loans"
        className="mt-1"
      />

      <View className={`mx-5 mt-3 mb-1 rounded-2xl border p-5 ${hero.box}`}>
        <AppText variant="overline">{hero.overline}</AppText>
        <Text
          className={`text-[32px] font-oswald-medium mt-1 ${hero.text}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.4}
        >
          {formatAmount(totals[segment])}
        </Text>
        <AppText variant="meta">{heroMeta[segment]}</AppText>
      </View>

      <FlatList
        data={entries}
        keyExtractor={({ id }) => id}
        renderItem={renderItem}
        refreshControl={refreshControl}
        ListEmptyComponent={EMPTY_STATE[segment]}
        contentContainerClassName="pb-[140px]"
      />
    </SafeAreaView>
  );
}

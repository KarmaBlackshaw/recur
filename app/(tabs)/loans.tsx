import React, { useMemo, useState } from "react";
import { useBoolean } from "@/utils/useBoolean";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { sumBy, orderBy, groupBy } from "@/utils/collections";
import { useLoans } from "@/context/LoanContext";
import { useAccounts } from "@/context/AccountContext";
import { BorrowerRow } from "@/components/loans/BorrowerRow";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { AppTabs } from "@/components/ui/AppTabs";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { formatAmount } from "@/utils/formatAmount";
import { colors } from "@/constants/theme";
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

function countLabel(count: number, singular: string) {
  return `${count} ${singular} loan${count === 1 ? "" : "s"}`;
}

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

export default function LoansScreen() {
  const loans = useLoans();
  const accounts = useAccounts();
  const refreshControl = useRefreshControl();
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const segment = SEGMENTS.find(({ value }) => value === params.segment)?.value ?? "active";
  const [search, setSearch] = useState("");
  const [isSearchOpen, searchOpen] = useBoolean(false);

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
  const query = isSearchOpen ? search.trim().toLowerCase() : "";
  const matches = data[segment].filter(({ borrower }) => borrower.toLowerCase().includes(query));
  const groups = Object.entries(groupBy(matches, "borrower")).map(([borrower, items]) => ({
    borrower,
    loanIds: items.map(({ id }) => id),
    amount: sumBy(items, ({ id }) =>
      segment === "active" ? (loans.summaries[id]?.balance ?? 0) : (loans.summaries[id]?.paidTotal ?? 0)
    ),
  }));
  // Active: who owes the most first, as on Home. Settled: most recently settled first.
  const entries = segment === "active" ? orderBy(groups, "amount", "desc") : groups;
  const hero = HERO[segment];
  const totals: Record<Segment, number> = {
    active: sumBy(active, ({ id }) => loans.summaries[id]?.balance ?? 0),
    settled: sumBy(settled, ({ id }) => loans.summaries[id]?.paidTotal ?? 0),
  };
  const heroMeta: Record<Segment, string> = {
    active: active.length > 0 ? countLabel(active.length, "active") : "No active loans",
    settled: countLabel(settled.length, "settled"),
  };
  const tabs = SEGMENTS.map((tab) => ({ ...tab, label: `${tab.label} · ${data[tab.value].length}` }));

  function toggleSearch() {
    if (isSearchOpen) {
      setSearch("");
    }
    searchOpen.toggle();
  }

  // A borrower with a single loan in this segment opens that loan straight away.
  function openBorrower({ borrower, loanIds }: (typeof entries)[number]) {
    if (loanIds.length === 1) {
      router.push({ pathname: "/loan/[id]", params: { id: loanIds[0] } });
      return;
    }
    router.push({ pathname: "/loan/borrower", params: { name: borrower } });
  }

  const renderItem = ({ item }: { item: (typeof entries)[number] }) => (
    <BorrowerRow
      borrower={item.borrower}
      loanCount={item.loanIds.length}
      amount={item.amount}
      isSettled={segment === "settled"}
      onPress={() => openBorrower(item)}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-5 pt-2 pb-1">
        <AppText variant="display">Loans</AppText>
        <TouchableOpacity
          onPress={toggleSearch}
          className="w-11 h-11 items-center justify-center -mr-2 ml-1"
          accessibilityRole="button"
          accessibilityLabel={isSearchOpen ? "Close search" : "Search borrower"}
          accessibilityState={{ expanded: isSearchOpen }}
        >
          <Feather name={isSearchOpen ? "x" : "search"} size={20} color={isSearchOpen ? colors.secondary : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isSearchOpen && (
        <View className="mx-5 -mt-3">
          <AppTextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search borrower"
            accessibilityLabel="Search borrower"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      )}

      <AppTabs
        tabs={tabs}
        value={segment}
        onChange={(next) => router.setParams({ segment: next })}
        className="mx-5 mt-2 mb-2"
      />

      <FlatList
        data={entries}
        keyExtractor={({ borrower }) => borrower}
        renderItem={renderItem}
        ListHeaderComponent={
          <View className={`mx-5 mb-1 rounded-2xl border p-5 ${hero.box}`}>
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
        }
        refreshControl={refreshControl}
        ListEmptyComponent={
          query ? <EmptyState icon="search" title="No matches" message={`No borrower matches "${search.trim()}"`} /> : EMPTY_STATE[segment]
        }
        contentContainerClassName="pb-[140px]"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

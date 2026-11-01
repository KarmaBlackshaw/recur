import React, { useMemo, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { keyBy, sumBy } from "@/utils/collections";
import { useBoolean } from "@/utils/useBoolean";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { DayGroupedExpenseList, type DayTotal } from "@/components/DayGroupedExpenseList";
import { ActivityHero } from "@/components/activity/ActivityHero";
import type { HeroTone } from "@/components/ui/AppHeroCard";
import { countLabel } from "@/utils/countLabel";
import { netFlow } from "@/utils/activity/netFlow";
import { loanFlow } from "@/utils/activity/loanFlow";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { useMonthActivity } from "@/utils/useMonthActivity";
import { matchesActivity, type ActivitySearchContext } from "@/utils/activitySearch";
import type { ActivitySegment, FeatherIconName, TOption } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { AppText } from "@/components/ui/AppText";
import { AppChips } from "@/components/ui/AppChips";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";

const SEGMENTS: TOption<ActivitySegment>[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Charged", value: "charged" },
  { label: "Income", value: "income" },
  { label: "Transfers", value: "transfers" },
  { label: "Loans", value: "loans" },
];

const HERO: Record<ActivitySegment, { overline: string; tone: HeroTone }> = {
  all: { overline: "Net this month", tone: "primary" },
  paid: { overline: "Paid this month", tone: "paid" },
  charged: { overline: "Charged this month", tone: "secondary" },
  income: { overline: "Received this month", tone: "paid" },
  transfers: { overline: "Transferred this month", tone: "neutral" },
  loans: { overline: "Lent this month", tone: "secondary" },
};

const EMPTY: Record<ActivitySegment, { title: string; icon: FeatherIconName; message: string }> = {
  all: { title: "No activity", icon: "list", message: "Nothing happened in" },
  paid: { title: "Nothing paid", icon: "check-circle", message: "No expenses paid in" },
  charged: { title: "Nothing charged", icon: "credit-card", message: "Nothing charged in" },
  income: { title: "No income", icon: "arrow-down-left", message: "No income in" },
  transfers: { title: "No transfers", icon: "repeat", message: "No transfers in" },
  loans: { title: "No loan activity", icon: "users", message: "Nothing lent or repaid in" },
};

// All and Loans mix money in and out, so their days show a signed net; All's adds up to the hero's net.
const DAY_TOTAL: Record<ActivitySegment, DayTotal> = {
  all: netFlow,
  paid: "sum",
  charged: "sum",
  income: "sum",
  transfers: "sum",
  loans: loanFlow,
};

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const { accounts } = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const params = useLocalSearchParams<{ segment?: string; year?: string; month?: string }>();
  // "Charged" only means something once there's a credit card to charge.
  const segments = accounts.some((a) => a.type === "credit") ? SEGMENTS : SEGMENTS.filter(({ value }) => value !== "charged");
  const segment = segments.find(({ value }) => value === params.segment)?.value ?? "all";
  const today = dayjs().startOf("day").toDate();
  const paramYear = Number.parseInt(params.year ?? "", 10);
  const paramMonth = Number.parseInt(params.month ?? "", 10);
  // A year past four digits can't be shown (and past ±275,760 isn't even a Date), so it falls back like a bad month.
  const year = paramYear >= 1000 && paramYear <= 9999 ? paramYear : today.getFullYear();
  const month = paramMonth >= 0 && paramMonth <= 11 ? paramMonth : today.getMonth();
  const [search, setSearch] = useState("");
  const [isSearchOpen, searchOpen] = useBoolean(false);
  const query = isSearchOpen ? search.trim() : "";
  const statsType = segment === "income" ? "income" : "expenses";

  function openStats() {
    router.push(`/stats?year=${year}&month=${month}&type=${statsType}`, { dangerouslySingular: true });
  }

  const searchContext = useMemo<ActivitySearchContext>(() => {
    const accountsById = keyBy(accounts, "id");
    return { accountName: (id) => (id == null ? undefined : accountsById[id]?.name) };
  }, [accounts]);

  // Search spans every month, newest first (the feed is already sorted).
  const results = useMemo(
    () => (query === "" ? [] : feed.all.filter((entry) => matchesActivity(entry, query, searchContext))),
    [feed.all, query, searchContext]
  );

  const { byFilter, lent, moneyIn, paidTotal } = useMonthActivity(feed, year, month);

  const entries = byFilter[segment];
  // Lending stays out of the net: money lent is still yours (net worth counts it as an asset).
  const totals: Record<ActivitySegment, number> = {
    all: moneyIn - paidTotal,
    paid: paidTotal,
    charged: sumBy(entries, "amount"),
    income: moneyIn,
    transfers: sumBy(entries, "amount"),
    loans: lent,
  };
  const total = totals[segment];
  const hero = HERO[segment];
  const empty = EMPTY[segment];
  const monthLabel = dayjs(new Date(year, month, 1)).format("MMMM");

  function toggleSearch() {
    if (isSearchOpen) {
      setSearch("");
    }
    searchOpen.toggle();
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between pl-5 pr-2 pt-2 pb-1">
        <AppText variant="display">Activity</AppText>
        <View className="flex-row items-center">
          {query === "" && (
            <PeriodNavigator
              year={year}
              month={month}
              onChange={(year, month) => router.setParams({ year: String(year), month: String(month) })}
            />
          )}
          <TouchableOpacity
            onPress={toggleSearch}
            className="w-11 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={isSearchOpen ? "Close search" : "Search activity"}
            accessibilityState={{ expanded: isSearchOpen }}
          >
            <Feather name={isSearchOpen ? "x" : "search"} size={20} color={isSearchOpen ? colors.secondary : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {isSearchOpen && (
        <View className="mx-5 -mt-3">
          <AppTextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Search activity"
            accessibilityLabel="Search activity"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      )}

      {query !== "" ? (
        <>
          <AppText variant="meta" className="px-5 pt-2 pb-1" accessibilityLiveRegion="polite">
            {`${countLabel(results.length, "result", "results")} for "${query}"`}
          </AppText>
          <DayGroupedExpenseList
            entries={results}
            dayTotal="none"
            refreshControl={refreshControl}
            ListEmptyComponent={<EmptyState icon="search" title="No matches" message={`Nothing matches "${query}"`} />}
          />
        </>
      ) : (
        <>
          <AppChips
            chips={segments}
            value={segment}
            onChange={(next) => router.setParams({ segment: next })}
            accessibilityLabel="Filter activity"
            className="mt-1"
          />

          <ActivityHero overline={hero.overline} total={total} tone={hero.tone} onStatsPress={openStats} />

          <DayGroupedExpenseList
            entries={entries}
            dayTotal={DAY_TOTAL[segment]}
            refreshControl={refreshControl}
            ListEmptyComponent={<EmptyState title={empty.title} icon={empty.icon} message={`${empty.message} ${monthLabel}`} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

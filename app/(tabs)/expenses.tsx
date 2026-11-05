import React, { useMemo, useRef, useState } from "react";
import { Keyboard, View, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { keyBy, sumBy } from "@/utils/collections";
import { useBoolean } from "@/utils/useBoolean";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { DayGroupedExpenseList, type ActivityEntry, type DayTotal } from "@/components/DayGroupedExpenseList";
import { ActivityHero } from "@/components/activity/ActivityHero";
import { CategoryFilterSheet, type CategoryFilterSheetRef } from "@/components/activity/CategoryFilterSheet";
import { ActivityFilterPanel } from "@/components/activity/ActivityFilterPanel";
import type { HeroTone } from "@/components/ui/AppHeroCard";
import { countLabel } from "@/utils/countLabel";
import { netFlow } from "@/utils/activity/netFlow";
import { loanFlow } from "@/utils/activity/loanFlow";
import { categoryLine, categorySlice } from "@/utils/activity/categoryLine";
import { categoryIcon } from "@/utils/categories";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { usePeriodActivity } from "@/utils/usePeriodActivity";
import { matchesActivity, type ActivitySearchContext } from "@/utils/activitySearch";
import type { ActivitySegment, FeatherIconName, MoneyFlow, TOption } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { AppText } from "@/components/ui/AppText";
import { AppTabs } from "@/components/ui/AppTabs";
import { colors } from "@/constants/theme";
import { parseMoneyFlow, parsePeriod, PERIODS } from "@/constants/periods";

const SEGMENTS: TOption<ActivitySegment>[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Charged", value: "charged" },
  { label: "Income", value: "income" },
  { label: "Transfers", value: "transfers" },
  { label: "Loans", value: "loans" },
];

// The hero reads "<label> this month" (or "this year").
const HERO: Record<ActivitySegment, { label: string; tone: HeroTone }> = {
  all: { label: "Net", tone: "primary" },
  paid: { label: "Paid", tone: "paid" },
  charged: { label: "Charged", tone: "secondary" },
  income: { label: "Received", tone: "paid" },
  transfers: { label: "Transferred", tone: "neutral" },
  loans: { label: "Lent", tone: "secondary" },
};

// Filtered to one category, Activity mirrors that Stats slice: "<category> spent" or "received", like Stats' donut.
const CATEGORY_HERO: Record<MoneyFlow, { label: string; tone: HeroTone; emptyTitle: string }> = {
  expenses: { label: "Spent", tone: "primary", emptyTitle: "Nothing spent" },
  income: { label: "Received", tone: "paid", emptyTitle: "No income" },
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

// A category's days add up what each row brought to it (a transfer's fee, not the amount moved), signed like All's.
const CATEGORY_DAY_TOTAL: Record<MoneyFlow, DayTotal> = {
  income: (entry) => categoryLine(entry, "income")?.amount ?? 0,
  expenses: (entry) => -(categoryLine(entry, "expenses")?.amount ?? 0),
};

interface ListView {
  entries: ActivityEntry[];
  total: number;
  hero: { label: string; tone: HeroTone };
  empty: { title: string; icon: FeatherIconName; message: string };
  dayTotal: DayTotal;
}

type CategoryView = ListView & { category: string; icon: FeatherIconName };

function categoryView(periodEntries: ActivityEntry[], flow: MoneyFlow, category: string): CategoryView {
  const { entries, total } = categorySlice(periodEntries, flow, category);
  const hero = CATEGORY_HERO[flow];
  // "<category> from loans" has no icon of its own, so it takes the one its rows carry, like its Stats slice.
  const icon = (entries.length > 0 ? categoryLine(entries[0], flow)?.icon : undefined) ?? categoryIcon(category);
  return {
    entries,
    total,
    hero,
    empty: { title: hero.emptyTitle, icon, message: `No ${category} in` },
    dayTotal: CATEGORY_DAY_TOTAL[flow],
    category,
    icon,
  };
}

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const { accounts } = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const params = useLocalSearchParams<{
    segment?: string;
    year?: string;
    month?: string;
    period?: string;
    category?: string;
    type?: string;
  }>();
  // "Charged" only means something once there's a credit card to charge.
  const segments = accounts.some((a) => a.type === "credit") ? SEGMENTS : SEGMENTS.filter(({ value }) => value !== "charged");
  const segment = segments.find(({ value }) => value === params.segment)?.value ?? "all";
  const today = dayjs().startOf("day").toDate();
  const paramYear = Number.parseInt(params.year ?? "", 10);
  const paramMonth = Number.parseInt(params.month ?? "", 10);
  // A year past four digits can't be shown (and past ±275,760 isn't even a Date), so it falls back like a bad month.
  const year = paramYear >= 1000 && paramYear <= 9999 ? paramYear : today.getFullYear();
  const month = paramMonth >= 0 && paramMonth <= 11 ? paramMonth : today.getMonth();
  const period = parsePeriod(params.period);
  // Set from the category sheet or a Stats category: the list narrows to the rows of that slice the type keeps.
  const category = params.category || undefined;
  const flow = parseMoneyFlow(params.type);
  const [search, setSearch] = useState("");
  // Closing the panel keeps its filters; the toggle's badge counts them.
  const [isFilterOpen, filterOpen] = useBoolean(false);
  const query = search.trim();
  const filterCount = [query !== "", segment !== "all", category != null].filter(Boolean).length;
  const isFiltered = filterCount > 0;
  const segmentFlow: MoneyFlow = segment === "income" ? "income" : "expenses";
  // Stats and the category picker open on the filtered category's side, else on the segment's.
  const statsType = category != null ? flow : segmentFlow;
  const categorySheetRef = useRef<CategoryFilterSheetRef>(null);

  function openStats() {
    router.push(`/stats?year=${year}&month=${month}&period=${period}&type=${statsType}`, { dangerouslySingular: true });
  }

  function openCategoryPicker() {
    categorySheetRef.current?.present();
  }

  function toggleFilters() {
    if (isFilterOpen) Keyboard.dismiss();
    filterOpen.toggle();
  }

  function clearFilters() {
    setSearch("");
    router.setParams({ segment: undefined, category: undefined, type: undefined });
  }

  const searchContext = useMemo<ActivitySearchContext>(() => {
    const accountsById = keyBy(accounts, "id");
    return { accountName: (id) => (id == null ? undefined : accountsById[id]?.name) };
  }, [accounts]);

  // A keyword spans every month of the type's rows, newest first (the feed is already sorted).
  const typeFeed: ActivityEntry[] = feed[segment];
  const keywordMatches = useMemo(
    () => (query === "" ? [] : typeFeed.filter((entry) => matchesActivity(entry, query, searchContext))),
    [typeFeed, query, searchContext]
  );
  const results = useMemo(
    () => (category == null ? keywordMatches : categorySlice(keywordMatches, flow, category).entries),
    [keywordMatches, category, flow]
  );
  const scopeNames = [segment === "all" ? null : segments.find(({ value }) => value === segment)?.label, category].filter(Boolean);
  const inScope = scopeNames.length === 0 ? "" : ` in ${scopeNames.join(", ")}`;

  const { byFilter, lent, moneyIn, paidTotal } = usePeriodActivity(feed, year, month, period);

  const segmentEntries = byFilter[segment];
  const filtered = useMemo(
    () => (category == null ? null : categoryView(segmentEntries, flow, category)),
    [segmentEntries, category, flow]
  );
  // Lending stays out of the net: money lent is still yours (net worth counts it as an asset).
  const segmentTotals: Record<ActivitySegment, () => number> = {
    all: () => moneyIn - paidTotal,
    paid: () => paidTotal,
    charged: () => sumBy(segmentEntries, "amount"),
    income: () => moneyIn,
    transfers: () => sumBy(segmentEntries, "amount"),
    loans: () => lent,
  };
  const view: ListView = filtered ?? {
    entries: segmentEntries,
    total: segmentTotals[segment](),
    hero: HERO[segment],
    empty: EMPTY[segment],
    dayTotal: DAY_TOTAL[segment],
  };
  const periodLabel = dayjs(new Date(year, month, 1)).format(period === "year" ? "YYYY" : "MMMM");
  const heroLabel = filtered == null ? view.hero.label : `${filtered.category} ${view.hero.label.toLowerCase()}`;
  const listedCount = query === "" ? view.entries.length : results.length;

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
              unit={period}
              year={year}
              month={month}
              onChange={(year, month) => router.setParams({ year: String(year), month: String(month) })}
            />
          )}
          <TouchableOpacity
            onPress={toggleFilters}
            className="w-11 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={isFiltered ? "Filters, on" : "Filters"}
            accessibilityState={{ expanded: isFilterOpen }}
          >
            <Feather name="sliders" size={20} color={isFilterOpen || isFiltered ? colors.secondary : colors.textSecondary} />
            {isFiltered && !isFilterOpen && (
              <View className="absolute top-1 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary items-center justify-center">
                <AppText variant="body-bold" className="text-[10px] leading-[13px]">
                  {filterCount}
                </AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isFilterOpen && (
        <ActivityFilterPanel
          search={search}
          onSearchChange={setSearch}
          types={segments}
          type={segment}
          onTypeChange={(next) => router.setParams({ segment: next })}
          category={
            filtered == null
              ? undefined
              : { name: filtered.category, icon: filtered.icon, meta: countLabel(listedCount, "transaction", "transactions") }
          }
          onPickCategory={openCategoryPicker}
          onClear={clearFilters}
          onClose={filterOpen.setFalse}
        />
      )}

      <View className="flex-1">
        {query !== "" ? (
          <>
            <AppText variant="meta" className="px-5 pt-2 pb-1" accessibilityLiveRegion="polite">
              {`${countLabel(results.length, "result", "results")} for "${query}"${inScope}`}
            </AppText>
            <DayGroupedExpenseList
              entries={results}
              dayTotal="none"
              refreshControl={refreshControl}
              ListEmptyComponent={<EmptyState icon="search" title="No matches" message={`Nothing matches "${query}"${inScope}`} />}
            />
          </>
        ) : (
          <>
            <AppTabs
              tabs={PERIODS}
              value={period}
              onChange={(next) => router.setParams({ period: next })}
              className="mx-5 mt-1"
            />

            <ActivityHero overline={`${heroLabel} this ${period}`} total={view.total} tone={view.hero.tone} onStatsPress={openStats} />

            <DayGroupedExpenseList
              entries={view.entries}
              dayTotal={view.dayTotal}
              refreshControl={refreshControl}
              ListEmptyComponent={
                <EmptyState title={view.empty.title} icon={view.empty.icon} message={`${view.empty.message} ${periodLabel}`} />
              }
            />
          </>
        )}
      </View>

      <CategoryFilterSheet
        ref={categorySheetRef}
        entries={query === "" ? segmentEntries : keywordMatches}
        category={category}
        flow={statsType}
        scope={query === "" ? `in ${periodLabel}` : `matching "${query}"`}
        onSelect={(category, type) => router.setParams({ category, type })}
      />
    </SafeAreaView>
  );
}

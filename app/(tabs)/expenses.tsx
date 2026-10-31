import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { keyBy, sumBy } from "@/utils/collections";
import { useBoolean } from "@/utils/useBoolean";
import { useSetState } from "@/utils/useSetState";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { DayGroupedExpenseList, type ActivityEntry, type DayTotal } from "@/components/DayGroupedExpenseList";
import { countLabel } from "@/utils/countLabel";
import { signedAmount } from "@/utils/signedAmount";
import { netFlow } from "@/utils/activity/netFlow";
import { loanFlow } from "@/utils/activity/loanFlow";
import { useActivityFeed } from "@/utils/useActivityFeed";
import { matchesActivity, type ActivitySearchContext } from "@/utils/activitySearch";
import type { FeatherIconName, TOption, TransactionKind } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { AppText } from "@/components/ui/AppText";
import { AppChips } from "@/components/ui/AppChips";
import { AppTextInput } from "@/components/ui/AppTextInput";
import { colors } from "@/constants/theme";

type Segment = "all" | "paid" | "charged" | "income" | "transfers" | "loans";

const SEGMENTS: TOption<Segment>[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Charged", value: "charged" },
  { label: "Income", value: "income" },
  { label: "Transfers", value: "transfers" },
  { label: "Loans", value: "loans" },
];

const HERO: Record<Segment, { overline: string; box: string; text: string }> = {
  all: { overline: "Net this month", box: "bg-primary/10 border-primary/20", text: "text-secondary" },
  paid: { overline: "Paid this month", box: "bg-paid/10 border-paid/20", text: "text-paid" },
  charged: { overline: "Charged this month", box: "bg-secondary/10 border-secondary/20", text: "text-secondary" },
  income: { overline: "Received this month", box: "bg-paid/10 border-paid/20", text: "text-paid" },
  transfers: { overline: "Transferred this month", box: "bg-white/[0.04] border-border", text: "text-white" },
  loans: { overline: "Lent this month", box: "bg-secondary/10 border-secondary/20", text: "text-secondary" },
};

const EMPTY: Record<Segment, { title: string; icon: FeatherIconName; message: string }> = {
  all: { title: "No activity", icon: "list", message: "Nothing happened in" },
  paid: { title: "Nothing paid", icon: "check-circle", message: "No expenses paid in" },
  charged: { title: "Nothing charged", icon: "credit-card", message: "Nothing charged in" },
  income: { title: "No income", icon: "arrow-down-left", message: "No income in" },
  transfers: { title: "No transfers", icon: "repeat", message: "No transfers in" },
  loans: { title: "No loan activity", icon: "users", message: "Nothing lent or repaid in" },
};

// All and Loans mix money in and out, so their days show a signed net; All's adds up to the hero's net.
const DAY_TOTAL: Record<Segment, DayTotal> = {
  all: netFlow,
  paid: "sum",
  charged: "sum",
  income: "sum",
  transfers: "sum",
  loans: loanFlow,
};

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const { accounts, transactions } = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const params = useLocalSearchParams<{ segment?: Segment }>();
  // "Charged" only means something once there's a credit card to charge.
  const segments = accounts.some((a) => a.type === "credit") ? SEGMENTS : SEGMENTS.filter(({ value }) => value !== "charged");
  const segment = segments.find(({ value }) => value === params.segment)?.value ?? "all";
  const today = dayjs().startOf("day").toDate();
  const [{ year, month }, setSelected] = useSetState({ year: today.getFullYear(), month: today.getMonth() });
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

  const { byFilter, fees, transferIncome, lent } = useMemo(() => {
    const isInMonth = ({ effDate }: { effDate: Date }) => effDate.getFullYear() === year && effDate.getMonth() === month;
    const monthTxnTotal = (kind: TransactionKind) =>
      sumBy(
        transactions.filter((t) => t.kind === kind).map((t) => ({ effDate: new Date(t.createdAt), amount: Math.abs(t.amount) })).filter(isInMonth),
        "amount"
      );
    const fees = monthTxnTotal("fee");
    const transfers = feed.transfers.filter(isInMonth);
    const loans = feed.loans.filter(isInMonth);
    const byFilter: Record<Segment, ActivityEntry[]> = {
      all: feed.all.filter(isInMonth),
      paid: feed.paid.filter(isInMonth),
      charged: feed.charged.filter(isInMonth),
      income: feed.income.filter(isInMonth),
      transfers,
      loans,
    };
    return {
      byFilter,
      fees,
      transferIncome: sumBy(transfers, "earned"),
      lent: sumBy(loans.filter(({ loanTxn }) => loanTxn.kind === "loan_out"), "amount"),
    };
  }, [feed, transactions, year, month]);

  const entries = byFilter[segment];
  const moneyIn = sumBy(byFilter.income, "amount") + transferIncome;
  const paidTotal = sumBy(byFilter.paid, "amount") + fees;
  // Lending stays out of the net: money lent is still yours (net worth counts it as an asset).
  const totals: Record<Segment, number> = {
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
              onChange={(year, month) => setSelected({ year, month })}
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

          <View className={`mx-5 mt-3 mb-1 rounded-2xl border ${hero.box}`}>
            <View className="px-5 pt-5 pb-3">
              <AppText variant="overline">{hero.overline}</AppText>
              <Text
                className={`text-[32px] font-oswald-medium mt-1 ${segment === "all" && total < 0 ? "text-overdue" : hero.text}`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.4}
              >
                {signedAmount(total)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={openStats}
              activeOpacity={0.7}
              className="min-h-[44px] flex-row items-center px-5 border-t border-white/[0.07]"
            >
              <Feather name="pie-chart" size={16} color={colors.textSecondary} />
              <AppText variant="body-bold" className="flex-1 ml-3 text-sm text-white">
                Stats
              </AppText>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

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

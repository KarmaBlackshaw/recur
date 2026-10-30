import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import { sumBy } from "@/utils/collections";
import { useSetState } from "@/utils/useSetState";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { PeriodNavigator } from "@/components/PeriodNavigator";
import { DayGroupedExpenseList, type ActivityEntry } from "@/components/DayGroupedExpenseList";
import { countLabel } from "@/utils/countLabel";
import { formatAmount } from "@/utils/dateHelpers";
import { useActivityFeed } from "@/utils/useActivityFeed";
import type { FeatherIconName, TransactionKind } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useRefreshControl } from "@/utils/useRefreshControl";
import { AppText } from "@/components/ui/AppText";
import { AppChips } from "@/components/ui/AppChips";

type Segment = "all" | "paid" | "charged" | "income" | "transfers";

const SEGMENTS: { label: string; value: Segment }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Charged", value: "charged" },
  { label: "Income", value: "income" },
  { label: "Transfers", value: "transfers" },
];

const HERO: Record<Segment, { overline: string; box: string; text: string }> = {
  all: { overline: "Net this month", box: "bg-primary/10 border-primary/20", text: "text-secondary" },
  paid: { overline: "Paid this month", box: "bg-paid/10 border-paid/20", text: "text-paid" },
  charged: { overline: "Charged this month", box: "bg-secondary/10 border-secondary/20", text: "text-secondary" },
  income: { overline: "Received this month", box: "bg-paid/10 border-paid/20", text: "text-paid" },
  transfers: { overline: "Transferred this month", box: "bg-white/[0.04] border-border", text: "text-white" },
};

const EMPTY: Record<Segment, { title: string; icon: FeatherIconName; message: string }> = {
  all: { title: "No activity", icon: "list", message: "Nothing happened in" },
  paid: { title: "Nothing paid", icon: "check-circle", message: "No expenses paid in" },
  charged: { title: "Nothing charged", icon: "credit-card", message: "Nothing charged in" },
  income: { title: "No income", icon: "arrow-down-left", message: "No income in" },
  transfers: { title: "No transfers", icon: "repeat", message: "No transfers in" },
};

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const { isCharged, transactions } = useAccounts();
  const refreshControl = useRefreshControl();
  const feed = useActivityFeed();
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const segment = SEGMENTS.find(({ value }) => value === params.segment)?.value ?? "all";
  const today = dayjs().startOf("day").toDate();
  const [{ year, month }, setSelected] = useSetState({ year: today.getFullYear(), month: today.getMonth() });

  const { byFilter, notPaidOff, fees, transferIncome } = useMemo(() => {
    const isInMonth = ({ effDate }: { effDate: Date }) => effDate.getFullYear() === year && effDate.getMonth() === month;
    const charged = feed.charged.filter(isInMonth);
    const notPaidOff = sumBy(
      charged.filter(({ expense, refDate }) =>
        expense.recurrence === "one-off"
          ? isCharged(expense.id, null, null)
          : isCharged(expense.id, refDate.getFullYear(), refDate.getMonth())
      ),
      "amount"
    );
    const monthTxnTotal = (kind: TransactionKind) =>
      sumBy(
        transactions.filter((t) => t.kind === kind).map((t) => ({ effDate: new Date(t.createdAt), amount: Math.abs(t.amount) })).filter(isInMonth),
        "amount"
      );
    const fees = monthTxnTotal("fee");
    const transfers = feed.transfers.filter(isInMonth);
    const byFilter: Record<Segment, ActivityEntry[]> = {
      all: feed.all.filter(isInMonth),
      paid: feed.paid.filter(isInMonth),
      charged,
      income: feed.income.filter(isInMonth),
      transfers,
    };
    return { byFilter, notPaidOff, fees, transferIncome: sumBy(transfers, "earned") };
  }, [feed, transactions, isCharged, year, month]);

  const entries = byFilter[segment];
  const moneyIn = sumBy(byFilter.income, "amount") + transferIncome;
  const paidTotal = sumBy(byFilter.paid, "amount") + fees;
  const totals: Record<Segment, number> = {
    all: moneyIn - paidTotal,
    paid: paidTotal,
    charged: sumBy(entries, "amount"),
    income: moneyIn,
    transfers: sumBy(entries, "amount"),
  };
  const total = totals[segment];
  const hero = HERO[segment];
  const heroMeta: Record<Segment, string> = {
    all: `${formatAmount(moneyIn)} in · ${formatAmount(paidTotal)} out`,
    paid: [countLabel(entries.length, "payment", "payments"), fees > 0 ? `incl. ${formatAmount(fees)} fees` : null]
      .filter(Boolean)
      .join(" · "),
    charged: `${formatAmount(notPaidOff)} not yet paid off`,
    income: [
      countLabel(entries.length, "income", "incomes"),
      transferIncome > 0 ? `incl. ${formatAmount(transferIncome)} from transfers` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    transfers: [
      countLabel(entries.length, "transfer", "transfers"),
      fees > 0 ? `${formatAmount(fees)} fees` : null,
      transferIncome > 0 ? `${formatAmount(transferIncome)} income` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
  const empty = EMPTY[segment];
  const monthLabel = dayjs(new Date(year, month, 1)).format("MMMM");

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
        <PeriodNavigator
          year={year}
          month={month}
          onChange={(year, month) => setSelected({ year, month })}
        />
      </View>

      <AppChips
        chips={SEGMENTS}
        value={segment}
        onChange={(next) => router.setParams({ segment: next })}
        accessibilityLabel="Filter activity"
        className="mt-1"
      />

      <View className={`mx-5 mt-3 mb-1 rounded-2xl border p-5 ${hero.box}`}>
        <AppText variant="overline">{hero.overline}</AppText>
        <Text
          className={`text-[32px] font-oswald-medium mt-1 ${segment === "all" && total < 0 ? "text-overdue" : hero.text}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.4}
        >
          {formatAmount(total)}
        </Text>
        <AppText variant="meta">{heroMeta[segment]}</AppText>
      </View>

      <DayGroupedExpenseList
        entries={entries}
        showDayTotals={segment !== "all"}
        refreshControl={refreshControl}
        ListEmptyComponent={<EmptyState title={empty.title} icon={empty.icon} message={`${empty.message} ${monthLabel}`} />}
      />
    </SafeAreaView>
  );
}

import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import dayjs from "dayjs";
import sumBy from "lodash/sumBy";
import orderBy from "lodash/orderBy";
import useSetState from "ahooks/es/useSetState";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { MonthNavigator } from "@/components/MonthNavigator";
import { DayGroupedExpenseList, type LedgerEntry, type ActivityEntry } from "@/components/DayGroupedExpenseList";
import { formatAmount } from "@/utils/dateHelpers";
import { usePaidLedger, useBillPayments, useTransfers, type IncomeEntry } from "@/utils/usePaidLedger";
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

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const { isCharged, transactions } = useAccounts();
  const refreshControl = useRefreshControl();
  const ledger = usePaidLedger();
  const billPayments = useBillPayments();
  const transfers = useTransfers();
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const segment = SEGMENTS.find(({ value }) => value === params.segment)?.value ?? "all";
  const today = dayjs().startOf("day").toDate();
  const [{ year, month }, setSelected] = useSetState({ year: today.getFullYear(), month: today.getMonth() });

  const { byFilter, notPaidOff, fees, interest, tax } = useMemo(() => {
    const isInMonth = ({ effDate }: { effDate: Date }) => effDate.getFullYear() === year && effDate.getMonth() === month;
    const monthLedger = ledger.filter(isInMonth);
    const cardItems = monthLedger.filter((it) => it.isCard);
    const paid: LedgerEntry[] = orderBy(
      [...monthLedger.filter((it) => !it.isCard).map((it) => ({ ...it, compact: true })), ...billPayments.filter(isInMonth)],
      "effDate",
      "desc"
    );
    const charged: LedgerEntry[] = cardItems.map((it) => ({ ...it, compact: true }));
    const income: IncomeEntry[] = orderBy(
      transactions
        .filter((t) => t.kind === "income")
        .map((t) => ({ key: t.id, income: t, effDate: new Date(t.createdAt), amount: t.amount }))
        .filter(isInMonth),
      "effDate",
      "desc"
    );
    const monthTransfers = transfers.filter(isInMonth);
    const notPaidOff = sumBy(
      cardItems.filter(({ expense, refDate }) =>
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
    const interest = monthTxnTotal("interest");
    const tax = monthTxnTotal("tax");
    const byFilter: Record<Segment, ActivityEntry[]> = {
      all: orderBy([...paid, ...charged, ...income, ...monthTransfers], "effDate", "desc"),
      paid,
      charged,
      income,
      transfers: monthTransfers,
    };
    return { byFilter, notPaidOff, fees, interest, tax };
  }, [ledger, billPayments, transfers, transactions, isCharged, year, month]);

  const entries = byFilter[segment];
  const moneyIn = sumBy(byFilter.income, "amount") + interest;
  const paidTotal = sumBy(byFilter.paid, "amount") + fees;
  const moneyOut = paidTotal + tax;
  const totals: Record<Segment, number> = {
    all: moneyIn - moneyOut,
    paid: paidTotal,
    charged: sumBy(entries, "amount"),
    income: sumBy(entries, "amount"),
    transfers: sumBy(entries, "amount"),
  };
  const total = totals[segment];
  const hero = HERO[segment];
  const heroMeta: Record<Segment, string> = {
    all: `${formatAmount(moneyIn)} in · ${formatAmount(moneyOut)} out`,
    paid: [countLabel(entries.length, "payment", "payments"), fees > 0 ? `incl. ${formatAmount(fees)} fees` : null]
      .filter(Boolean)
      .join(" · "),
    charged: `${formatAmount(notPaidOff)} not yet paid off`,
    income: countLabel(entries.length, "income", "incomes"),
    transfers: [countLabel(entries.length, "transfer", "transfers"), fees > 0 ? `${formatAmount(fees)} fees` : null]
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
        <MonthNavigator
          year={year}
          month={month}
          onChange={(year, month) => setSelected({ year, month })}
        />
      </View>

      <DayGroupedExpenseList
        entries={entries}
        showDayTotals={segment !== "all"}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
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
          </>
        }
        ListEmptyComponent={<EmptyState title={empty.title} icon={empty.icon} message={`${empty.message} ${monthLabel}`} />}
      />
    </SafeAreaView>
  );
}

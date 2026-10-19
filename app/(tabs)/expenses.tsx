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
import { DayGroupedExpenseList, type LedgerEntry } from "@/components/DayGroupedExpenseList";
import { IncomeList } from "@/components/IncomeList";
import { formatAmount } from "@/utils/dateHelpers";
import { usePaidLedger, useBillPayments } from "@/utils/usePaidLedger";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppText } from "@/components/ui/AppText";
import { AppTabs } from "@/components/ui/AppTabs";

type Segment = "paid" | "charged" | "income";

const SEGMENTS: { label: string; value: Segment }[] = [
  { label: "Paid", value: "paid" },
  { label: "Charged", value: "charged" },
  { label: "Income", value: "income" },
];

const HERO: Record<Segment, { title: string; overline: string; box: string; text: string }> = {
  paid: { title: "Paid", overline: "Paid this month", box: "bg-paid/10 border-paid/20", text: "text-paid" },
  charged: { title: "Charged", overline: "Charged this month", box: "bg-secondary/10 border-secondary/20", text: "text-secondary" },
  income: { title: "Income", overline: "Received this month", box: "bg-paid/10 border-paid/20", text: "text-paid" },
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ExpensesScreen() {
  const { loading } = useExpenses();
  const { isCharged, transactions } = useAccounts();
  const ledger = usePaidLedger();
  const billPayments = useBillPayments();
  const params = useLocalSearchParams<{ segment?: Segment }>();
  const segment = SEGMENTS.find(({ value }) => value === params.segment)?.value ?? "paid";
  const today = dayjs().startOf("day").toDate();
  const [{ year, month }, setSelected] = useSetState({ year: today.getFullYear(), month: today.getMonth() });

  const incomeEntries = useMemo(
    () =>
      orderBy(
        transactions.filter((t) => {
          const date = new Date(t.createdAt);
          return t.kind === "income" && date.getFullYear() === year && date.getMonth() === month;
        }),
        "createdAt",
        "desc"
      ),
    [transactions, year, month]
  );

  const { paidEntries, chargedEntries, notPaidOff } = useMemo(() => {
    const isInMonth = ({ effDate }: { effDate: Date }) => effDate.getFullYear() === year && effDate.getMonth() === month;
    const monthLedger = ledger.filter(isInMonth);
    const cardItems = monthLedger.filter((it) => it.isCard);
    const paidEntries: LedgerEntry[] = orderBy(
      [...monthLedger.filter((it) => !it.isCard).map((it) => ({ ...it, compact: true })), ...billPayments.filter(isInMonth)],
      "effDate",
      "desc"
    );
    const chargedEntries: LedgerEntry[] = cardItems.map((it) => ({ ...it, compact: true }));
    const notPaidOff = sumBy(
      cardItems.filter(({ expense, refDate }) =>
        expense.recurrence === "one-off"
          ? isCharged(expense.id, null, null)
          : isCharged(expense.id, refDate.getFullYear(), refDate.getMonth())
      ),
      "amount"
    );
    return { paidEntries, chargedEntries, notPaidOff };
  }, [ledger, billPayments, isCharged, year, month]);

  const isChargedSegment = segment === "charged";
  const isIncomeSegment = segment === "income";
  const entries = isChargedSegment ? chargedEntries : paidEntries;
  const total = isIncomeSegment ? sumBy(incomeEntries, "amount") : sumBy(entries, "amount");
  const hero = HERO[segment];
  const heroMeta = isIncomeSegment
    ? countLabel(incomeEntries.length, "income", "incomes")
    : isChargedSegment
      ? `${formatAmount(notPaidOff)} not yet paid off`
      : countLabel(entries.length, "payment", "payments");
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
        <AppText variant="display">{hero.title}</AppText>
        <MonthNavigator
          year={year}
          month={month}
          onChange={(year, month) => setSelected({ year, month })}
        />
      </View>

      <AppTabs tabs={SEGMENTS} value={segment} onChange={(next) => router.setParams({ segment: next })} className="mx-5 mt-1" />

      <View className={`mx-5 mt-2 mb-1 rounded-2xl border p-5 ${hero.box}`}>
        <AppText variant="overline">{hero.overline}</AppText>
        <Text
          className={`text-[32px] font-oswald-medium mt-1 ${hero.text}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.4}
        >
          {formatAmount(total)}
        </Text>
        <AppText variant="meta">{heroMeta}</AppText>
      </View>

      {isIncomeSegment ? (
        <IncomeList
          entries={incomeEntries}
          ListEmptyComponent={<EmptyState title="No income" icon="arrow-down-left" message={`No income in ${monthLabel}`} />}
        />
      ) : (
        <DayGroupedExpenseList
          entries={entries}
          ListEmptyComponent={
            isChargedSegment ? (
              <EmptyState title="Nothing charged" icon="credit-card" message={`Nothing charged in ${monthLabel}`} />
            ) : (
              <EmptyState title="Nothing paid" icon="check-circle" message={`No expenses paid in ${monthLabel}`} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

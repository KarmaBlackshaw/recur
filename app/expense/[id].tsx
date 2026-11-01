import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import dayjs from "dayjs";
import { useExpenses } from "@/context/ExpenseContext";
import { useAccounts } from "@/context/AccountContext";
import { usePayFlow } from "@/context/PayFlowContext";
import { AppButton } from "@/components/ui/AppButton";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { AppFormHeader } from "@/components/ui/AppFormHeader";
import { AppLabel } from "@/components/ui/AppLabel";
import { AppListRow, type RowTone } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { AppHeroAmount } from "@/components/ui/AppHeroAmount";
import { LoadingState } from "@/components/ui/LoadingState";
import { colors } from "@/constants/theme";
import {
  cycleStateOn,
  formatDaysLate,
  formatDueDate,
  formatMonth,
  formatOrdinal,
  getDueDateForMonth,
  hasCycleIn,
  isOverdueOn,
  nextCycleDueDate,
  type CycleState,
} from "@/utils/dateHelpers";
import { formatAmount } from "@/utils/formatAmount";
import { expenseTitle } from "@/utils/expenseHelpers";
import { useDeleteExpense } from "@/utils/useDeleteExpense";
import type { Expense, FeatherIconName } from "@/types";

interface Cycle {
  year: number;
  month: number;
}

const HISTORY_LIMIT = 24;

function parseNumberParam(value?: string): number | null {
  if (value == null) {
    return null;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

// Bills saved before start months existed begin in the month they were created.
function startOfPlan(expense: Expense): Cycle {
  if (expense.startYear != null && expense.startMonth != null) {
    return { year: expense.startYear, month: expense.startMonth };
  }
  const created = dayjs(expense.createdAt);
  return { year: created.year(), month: created.month() };
}

// This month when it has a bill, else the next month that does.
function defaultCycle(expense: Expense): Cycle {
  const today = dayjs();
  if (hasCycleIn(expense, today.year(), today.month())) {
    return { year: today.year(), month: today.month() };
  }
  const next = nextCycleDueDate(expense, today.year(), today.month());
  return next ? { year: next.getFullYear(), month: next.getMonth() } : { year: today.year(), month: today.month() };
}

// Months with a bill, newest first: from this month (or the end month, when earlier) back to the start month.
function historyOf(expense: Expense): Cycle[] {
  const start = startOfPlan(expense);
  const first = dayjs(new Date(start.year, start.month, 1));
  let cursor = dayjs().startOf("month");
  if (expense.endYear != null && expense.endMonth != null) {
    const end = dayjs(new Date(expense.endYear, expense.endMonth, 1));
    if (end.isBefore(cursor)) {
      cursor = end;
    }
  }
  const cycles: Cycle[] = [];
  while (!cursor.isBefore(first) && cycles.length < HISTORY_LIMIT) {
    if (hasCycleIn(expense, cursor.year(), cursor.month())) {
      cycles.push({ year: cursor.year(), month: cursor.month() });
    }
    cursor = cursor.subtract(1, "month");
  }
  return cycles;
}

// "Due today", "Due in 4 days", "Due Nov 30".
function dueLabel(due: Date): string {
  const when = formatDueDate(due);
  return `Due ${when === "Today" || when === "Tomorrow" ? when.toLowerCase() : when}`;
}

function reminderLabel(daysBefore: number | null | undefined): string {
  if (daysBefore === 0) {
    return "Off";
  }
  const days = daysBefore ?? 1;
  return `${days} ${days === 1 ? "day" : "days"} before`;
}

export default function BillScreen() {
  const params = useLocalSearchParams<{ id: string; year?: string; month?: string; action?: string }>();
  const { expenses, loading, getMonthStatus, getMonthPaidAt, getDisplayAmount } = useExpenses();
  const { accounts, transactions, isCardAccount } = useAccounts();
  const payFlow = usePayFlow();
  const confirmDelete = useDeleteExpense();
  const scrollRef = useRef<ScrollView>(null);
  const hasHandledAction = useRef(false);
  const [pickedCycle, setPickedCycle] = useState<Cycle | null>(null);

  const expense = expenses.find((e) => e.id === params.id);
  const isOneOff = expense?.recurrence === "one-off";
  const yearParam = parseNumberParam(params.year);
  const monthParam = parseNumberParam(params.month);
  const cycle: Cycle | null = expense
    ? pickedCycle ??
      (yearParam != null && monthParam != null ? { year: yearParam, month: monthParam } : defaultCycle(expense))
    : null;
  const history = useMemo(() => (expense && !isOneOff ? historyOf(expense) : []), [expense, isOneOff]);

  // One-offs have no months to show; their editor is their screen.
  useEffect(() => {
    if (expense && isOneOff) {
      router.replace({ pathname: "/expense/add", params: { id: expense.id } });
    }
  }, [expense?.id, isOneOff]);

  // Opened from a reminder's "Mark paid": ask for the payment once the bill has loaded.
  useEffect(() => {
    if (hasHandledAction.current || params.action !== "pay" || !expense || isOneOff || !cycle) {
      return;
    }
    hasHandledAction.current = true;
    const isDue = cycleStateOn(expense, cycle.year, cycle.month) === "active";
    if (isDue && getMonthStatus(expense.id, cycle.year, cycle.month) === "unpaid") {
      payFlow.openPaySheet(expense, cycle.year, cycle.month);
    }
  }, [params.action, expense, isOneOff, cycle?.year, cycle?.month]);

  if (loading || isOneOff) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!expense || !cycle) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8 gap-4">
        <Feather name="inbox" size={40} color={colors.textMuted} />
        <AppText variant="meta" className="text-center">This bill no longer exists.</AppText>
        <AppButton label="Back" variant="tonal" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const { year, month } = cycle;
  const title = expenseTitle(expense);
  const accountName = accounts.find((a) => a.id === expense.accountId)?.name;
  const subtitle = [title === expense.category ? null : expense.category, accountName].filter(Boolean).join(" · ");
  const isCardPaid = isCardAccount(expense.accountId);
  const start = startOfPlan(expense);

  const cycleState = cycleStateOn(expense, year, month);
  const isDue = cycleState === "active";
  const due = getDueDateForMonth(expense.dueDay, year, month);
  const isPaid = getMonthStatus(expense.id, year, month) === "paid";
  const isLate = isDue && !isPaid && isOverdueOn(expense.dueDay, year, month);
  const amount = getDisplayAmount(expense, year, month);
  const amountText = amount != null ? formatAmount(amount) : "TBD";
  const payment = transactions.find(
    (t) => t.kind === "payment" && t.expenseId === expense.id && t.cycleYear === year && t.cycleMonth === month
  );
  const paidFrom = payment ? accounts.find((a) => a.id === payment.accountId)?.name : undefined;
  const notDueText: Record<Exclude<CycleState, "active">, string> = {
    "off-cycle": "Not due this month",
    "not-started": `Starts ${formatMonth(start.year, start.month)}`,
    ended: expense.endYear != null ? `Ended ${formatMonth(expense.endYear, expense.endMonth ?? 0)}` : "Ended",
  };
  const statusText =
    cycleState !== "active"
      ? notDueText[cycleState]
      : isPaid
        ? `Paid ${dayjs(getMonthPaidAt(expense.id, year, month) ?? due).format("MMM D")}${paidFrom ? ` from ${paidFrom}` : ""}`
        : isLate
          ? `${formatDaysLate(due)} · due ${dayjs(due).format("MMM D")}`
          : dueLabel(due);
  const overline = `${dayjs(new Date(year, month, 1)).format("MMMM YYYY")} bill`;

  const yearlyDue = dayjs(getDueDateForMonth(expense.dueDay, start.year, start.month));
  const repeatsText =
    expense.recurrence === "yearly"
      ? isCardPaid ? `Every ${yearlyDue.format("MMMM")}, with the card bill` : `Every ${yearlyDue.format("MMMM D")}`
      : isCardPaid ? "With the card bill" : `Monthly on the ${formatOrdinal(expense.dueDay)}`;
  const planAmountText = expense.isVariable
    ? "Changes each month"
    : expense.amount != null ? formatAmount(expense.amount) : "TBD";
  const endsText = expense.endYear != null ? formatMonth(expense.endYear, expense.endMonth ?? 0) : "No end month";

  function selectCycle(next: Cycle) {
    setPickedCycle(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const renderHistoryRow = ({ year: rowYear, month: rowMonth }: Cycle) => {
    const monthStart = dayjs(new Date(rowYear, rowMonth, 1));
    const rowDue = getDueDateForMonth(expense.dueDay, rowYear, rowMonth);
    const isRowPaid = getMonthStatus(expense.id, rowYear, rowMonth) === "paid";
    const isRowLate = !isRowPaid && isOverdueOn(expense.dueDay, rowYear, rowMonth);
    const rowAmount = getDisplayAmount(expense, rowYear, rowMonth);
    const rowAmountText = rowAmount != null ? formatAmount(rowAmount) : "TBD";
    const meta = isRowPaid
      ? `Paid ${dayjs(getMonthPaidAt(expense.id, rowYear, rowMonth) ?? rowDue).format("MMM D")}`
      : isRowLate
        ? formatDaysLate(rowDue)
        : `Due ${dayjs(rowDue).format("MMM D")}`;
    const tone: RowTone = isRowPaid ? "positive" : isRowLate ? "negative" : "neutral";
    const icon: FeatherIconName = isRowPaid ? "check-circle" : isRowLate ? "alert-triangle" : "circle";
    const payLabel = `Mark ${monthStart.format("MMMM")} paid`;
    const pay = () => payFlow.pay(expense, rowYear, rowMonth);
    return (
      <AppListRow
        key={`${rowYear}-${rowMonth}`}
        icon={icon}
        iconTone={tone}
        title={monthStart.format("MMMM YYYY")}
        meta={meta}
        amount={rowAmountText}
        accessory={isRowPaid ? undefined : "circle"}
        onAccessoryPress={isRowPaid ? undefined : pay}
        onAccessoryLongPress={isRowPaid ? undefined : () => payFlow.openPaySheet(expense, rowYear, rowMonth)}
        accessoryLabel={payLabel}
        accessoryTone={isRowLate ? "negative" : "neutral"}
        onPress={() => selectCycle({ year: rowYear, month: rowMonth })}
        accessibilityLabel={`${monthStart.format("MMMM YYYY")}, ${rowAmountText}, ${meta}`}
        accessibilityHint="Shows this month's bill"
        accessibilityActions={isRowPaid ? undefined : [{ name: "pay", label: payLabel }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === "pay") {
            pay();
          }
        }}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppFormHeader
        title={title}
        subtitle={subtitle || undefined}
        right={
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/expense/add", params: { id: expense.id, year, month } })}
            className="w-11 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Edit bill"
          >
            <Feather name="edit-2" size={20} color={colors.secondary} />
          </TouchableOpacity>
        }
      />

      <ScrollView ref={scrollRef} contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        <View
          className={`mx-5 mt-3 rounded-2xl border p-5 ${isLate ? "bg-overdue/[0.06] border-overdue/30" : "bg-surface border-border"}`}
        >
          <View accessible accessibilityLabel={`${overline}, ${amountText}, ${statusText}`}>
            <AppText variant="overline">{overline}</AppText>
            <AppHeroAmount value={amountText} tone={isDue ? "neutral" : "muted"} className="mt-1" />
            <AppText variant="meta" className={`mt-1 ${isLate ? "text-overdue" : ""}`}>
              {statusText}
            </AppText>
          </View>
          {isDue &&
            (isPaid ? (
              <View className="flex-row gap-3 mt-4">
                <AppButton
                  label="Edit payment"
                  variant="tonal"
                  className="flex-1"
                  onPress={() => payFlow.openPaySheet(expense, year, month)}
                />
                <AppButton
                  label="Mark unpaid"
                  variant="ghost"
                  className="flex-1"
                  onPress={() => payFlow.unpay(expense, year, month)}
                />
              </View>
            ) : (
              <AppButton label="Mark paid" className="mt-4" onPress={() => payFlow.openPaySheet(expense, year, month)} />
            ))}
        </View>

        <View className="mt-3 px-5">
          <AppDetailRow label="Repeats" value={repeatsText} />
          <AppDetailRow label="Amount" value={planAmountText} />
          <AppDetailRow label="Starts" value={formatMonth(start.year, start.month)} />
          <AppDetailRow label="Ends" value={endsText} />
          <AppDetailRow label="Reminder" value={isCardPaid ? "With the card bill" : reminderLabel(expense.reminderDaysBefore)} />
        </View>

        {history.length > 0 && (
          <>
            <AppLabel className="px-5 mt-4" accessibilityRole="header">History</AppLabel>
            {history.map(renderHistoryRow)}
          </>
        )}

        <AppButton
          label="Delete expense"
          variant="destructive"
          className="mx-5 mt-8"
          onPress={() => confirmDelete(expense, year, month, () => router.back())}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

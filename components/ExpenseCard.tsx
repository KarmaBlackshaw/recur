import React from "react";
import { type AccessibilityActionEvent } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import dayjs from "dayjs";
import { AppListRow, type RowTone } from "@/components/ui/AppListRow";
import { SwipeableRow, type SwipeAction } from "@/components/ui/SwipeableRow";
import { formatDueDate, formatDaysLate, getDueDateForMonth, isOverdueOn, cycleStateOn, formatMonth, nextCycleDueDate } from "@/utils/dateHelpers";
import { categoryIcon } from "@/utils/categories";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { usePayFlow } from "@/context/PayFlowContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import { useDeleteExpense } from "@/utils/useDeleteExpense";
import { openExpense } from "@/utils/expenses/openExpense";
import { formatBillAmount } from "@/utils/expenses/formatBillAmount";
import type { Expense } from "@/types";

interface Props {
  expense: Expense;
  index?: number;
  referenceDate?: Date;
  onPress?: () => void;
  compact?: boolean;   // ledger row under a day header: no pay toggle, caption only flags card-account status
  hideDate?: boolean;  // caption shows the status word instead of the date
  canOpenBillSheet?: boolean; // unpaid rows open the bill sheet on tap (Home and Recurring due lists)
  isSwipeHintShown?: boolean; // peek the Pay swipe once to teach it
}

export function ExpenseCard({
  expense,
  index = 0,
  referenceDate,
  onPress,
  compact = false,
  hideDate = false,
  canOpenBillSheet = false,
  isSwipeHintShown = false,
}: Props) {
  const { getMonthStatus, getDisplayAmount, getMonthPaidAt } = useExpenses();
  const { accounts, isCharged, isCardAccount } = useAccounts();
  const payFlow = usePayFlow();
  const confirmDelete = useDeleteExpense();
  const accountName = accounts.find((a) => a.id === expense.accountId)?.name;
  const isReducedMotion = useReducedMotion();
  const refDate = referenceDate ?? new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const isRegular = expense.recurrence === "one-off";
  const dueDate = getDueDateForMonth(expense.dueDay, year, month);
  const resolvedStatus = getMonthStatus(expense.id, year, month);
  const isPaid = resolvedStatus === "paid";
  const isChargedNow = isPaid && isCharged(expense.id, isRegular ? null : year, isRegular ? null : month);
  // Paid recurring shows when it was actually paid (paid_at), not its due date.
  // Fall back to dueDate only for legacy rows recorded before paid_at existed.
  const paidAt = !isRegular ? getMonthPaidAt(expense.id, year, month) : null;
  // Not started yet, ended, or a yearly plan outside its month: nothing is due, so the row is muted.
  const cycleState = cycleStateOn(expense, year, month);
  const isInactive = cycleState !== "active";
  const overdueFlag = !isRegular && !isInactive && resolvedStatus === "unpaid" && isOverdueOn(expense.dueDay, year, month);
  const displayAmount = getDisplayAmount(expense, year, month);

  const title = expenseTitle(expense);
  const isCategoryTitle = title === expense.category;
  const amountText = formatBillAmount(displayAmount);
  const inactiveText: Record<typeof cycleState, string> = {
    active: "",
    ended: expense.endYear != null && expense.endMonth != null ? `Ended ${formatMonth(expense.endYear, expense.endMonth)}` : "Ended",
    "not-started":
      expense.startYear != null && expense.startMonth != null ? `Starts ${formatMonth(expense.startYear, expense.startMonth)}` : "Not started",
    "off-cycle": `Every ${dayjs(nextCycleDueDate(expense, year, month) ?? dueDate).format("MMM D")}`,
  };
  const dateText = isInactive
    ? inactiveText[cycleState]
    : isRegular
      ? dayjs(expense.createdAt).format("MMM D")
      : isPaid
        ? dayjs(paidAt ?? dueDate).format("MMM D")
        : overdueFlag
          ? formatDaysLate(dueDate)
          : formatDueDate(dueDate);
  const inactiveLabel: Record<typeof cycleState, string> = {
    active: "",
    ended: "Ended",
    "not-started": "Not started",
    "off-cycle": "Not due this month",
  };
  const statusLabel = isInactive
    ? inactiveLabel[cycleState]
    : isChargedNow ? "Charged" : isPaid ? "Paid" : overdueFlag ? "Overdue" : "Unpaid";
  // Settled captions stay neutral: the band or KPI already says "paid", and a mint caption on every
  // row would repeat it. Only card charges (indigo) and late dues (coral) get a tint.
  const statusTone: RowTone = isInactive ? "muted" : isChargedNow ? "accent" : overdueFlag ? "negative" : "neutral";
  // Ledger rows sit under a day header, so they only flag card-account status.
  const caption = compact || hideDate
    ? (!compact || isCardAccount(expense.accountId) ? statusLabel : undefined)
    : isPaid && !isInactive ? `${statusLabel} ${dateText}` : dateText;
  // One-offs are money already spent: they have no month to pay or unpay.
  const canToggle = !compact && !isInactive && !isRegular;
  const shouldOpenBillSheet = canOpenBillSheet && canToggle && !isPaid;

  function togglePaid() {
    if (isPaid) {
      payFlow.unpay(expense, year, month);
    } else {
      payFlow.pay(expense, year, month);
    }
  }

  function handlePress() {
    if (shouldOpenBillSheet) {
      payFlow.openBillSheet(expense, year, month);
    } else {
      openExpense(expense, year, month);
    }
  }

  function handleDelete() {
    confirmDelete(expense, year, month);
  }

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    if (nativeEvent.actionName === "toggle") {
      togglePaid();
    }
    if (nativeEvent.actionName === "delete") {
      handleDelete();
    }
  }

  const accessibilityActions = [
    ...(canToggle ? [{ name: "toggle", label: isPaid ? "Mark unpaid" : "Mark paid" }] : []),
    { name: "delete", label: "Delete" },
  ];

  const leftAction: SwipeAction | undefined = canToggle
    ? { label: isPaid ? "Unpay" : "Pay", icon: isPaid ? "rotate-ccw" : "check", tone: "positive", onPress: togglePaid }
    : undefined;
  const rightAction: SwipeAction = { label: "Delete", icon: "trash-2", tone: "negative", onPress: handleDelete };

  return (
    <SwipeableRow leftAction={leftAction} rightAction={rightAction} isHintShown={isSwipeHintShown}>
      <Animated.View entering={isReducedMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
        <AppListRow
          icon={categoryIcon(expense.category)}
          iconTone={overdueFlag ? "negative" : "neutral"}
          title={title}
          meta={[isCategoryTitle ? null : expense.category, accountName].filter(Boolean).join(" · ") || undefined}
          metaIcon={expense.reminderDaysBefore === 0 && !isRegular ? "bell-off" : undefined}
          amount={amountText}
          caption={caption}
          captionTone={statusTone}
          isMuted={isInactive}
          onPress={onPress ?? handlePress}
          accessibilityLabel={`${isCategoryTitle ? title : `${title}, ${expense.category}`}${accountName != null ? `, from ${accountName}` : ""}, ${amountText}, ${statusLabel}, ${dateText}`}
          accessibilityHint={isRegular ? "Opens editor" : "Opens the bill"}
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={handleAccessibilityAction}
        />
      </Animated.View>
    </SwipeableRow>
  );
}

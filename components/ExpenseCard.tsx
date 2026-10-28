import React from "react";
import { View, Alert, type AccessibilityActionEvent } from "react-native";
import { router } from "expo-router";
import { Pressable } from "react-native-gesture-handler";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { AppListRow, type RowTone } from "@/components/ui/AppListRow";
import { AppText } from "@/components/ui/AppText";
import { SwipeDeleteRow } from "@/components/ui/SwipeDeleteRow";
import dayjs from "dayjs";
import { formatDueDate, formatDaysLate, getDueDateForMonth, isOverdueOn, formatAmount, cycleStateOn, formatMonth, nextCycleDueDate } from "@/utils/dateHelpers";
import { categoryIcon } from "@/utils/categories";
import { useAccounts } from "@/context/AccountContext";
import { useExpenses } from "@/context/ExpenseContext";
import { expenseTitle } from "@/utils/expenseHelpers";
import { OverdraftError } from "@/utils/accounts/OverdraftError";
import { colors } from "@/constants/theme";
import type { Expense } from "@/types";

interface Props {
  expense: Expense;
  index?: number;
  referenceDate?: Date;
  onPress?: () => void;
  compact?: boolean;   // ledger row under a day header: no pay toggle, caption only flags card-account status
  hideDate?: boolean;  // caption shows the status word instead of the date
}

export function ExpenseCard({ expense, index = 0, referenceDate, onPress, compact = false, hideDate = false }: Props) {
  const { getMonthStatus, toggleMonthStatus, deleteExpense, getDisplayAmount, getMonthPaidAt, paidCycles } = useExpenses();
  const { accounts, transactions, isCharged, isCardAccount } = useAccounts();
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
  const amountText = displayAmount !== null ? formatAmount(displayAmount) : "TBD";
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
  const canToggle = !compact && !isInactive;

  async function handleToggle() {
    try {
      await toggleMonthStatus(expense.id, year, month);
    } catch (e) {
      console.error("Failed to update paid status", e);
      if (e instanceof OverdraftError) {
        Alert.alert("Can't mark paid", e.message);
      } else {
        Alert.alert("Update failed", "Something went wrong. Please try again.");
      }
    }
  }

  function handleDelete() {
    const confirmDelete = { text: "Delete", style: "destructive" as const, onPress: () => deleteExpense(expense.id) };
    const paidMonths = isRegular ? 0 : paidCycles.filter((c) => c.expenseId === expense.id).length;
    if (paidMonths === 0) {
      Alert.alert("Delete expense", `Remove "${title}"?`, [{ text: "Cancel", style: "cancel" }, confirmDelete]);
      return;
    }
    // Deleting a recurring expense drops its paid months from Activity and the totals, while the payments it
    // made stay in the account balances, so offer ending it instead.
    const hasPayments = transactions.some((t) => t.kind === "payment" && t.expenseId === expense.id);
    const history = `Its ${paidMonths} paid ${paidMonths === 1 ? "month leaves" : "months leave"} Activity and the totals.`;
    const balances = hasPayments ? " The payments stay in your account balances." : "";
    Alert.alert(
      `Delete "${title}"?`,
      `${history}${balances}\n\nTo stop it and keep the history, set an end month instead.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set end month",
          onPress: () =>
            router.push({ pathname: "/expense/add", params: { id: expense.id, year, month, endPrompt: "1" } }),
        },
        confirmDelete,
      ]
    );
  }

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    if (nativeEvent.actionName === "toggle") {
      handleToggle();
    }
    if (nativeEvent.actionName === "delete") {
      handleDelete();
    }
  }

  const accessibilityActions = [
    ...(canToggle ? [{ name: "toggle", label: isPaid ? "Mark unpaid" : "Mark paid" }] : []),
    { name: "delete", label: "Delete" },
  ];

  // RNGH Pressable, not TouchableOpacity: the swipeable's full-width right-actions layer sits on top
  // and swallows RN touches on the left side; RNGH's own hit-testing passes through it.
  function renderLeftActions(_progress: SharedValue<number>, _translation: SharedValue<number>, methods: SwipeableMethods) {
    function handleSwipeToggle() {
      methods.close();
      handleToggle();
    }

    return (
      <Pressable onPress={handleSwipeToggle} accessibilityRole="button" accessibilityLabel={isPaid ? "Mark unpaid" : "Mark paid"}>
        <View className="flex-1 justify-center items-center gap-1 w-20 my-1.5 ml-5 rounded-2xl bg-paid/15">
          <Feather name={isPaid ? "rotate-ccw" : "check"} size={20} color={colors.paid} />
          <AppText variant="meta" className="text-paid">{isPaid ? "Unpay" : "Pay"}</AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <SwipeDeleteRow onDelete={handleDelete} renderLeftActions={canToggle ? renderLeftActions : undefined}>
      <Animated.View entering={isReducedMotion ? undefined : FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
        <AppListRow
          icon={categoryIcon(expense.category)}
          iconTone={overdueFlag ? "negative" : "neutral"}
          title={title}
          meta={[isCategoryTitle ? null : expense.category, accountName].filter(Boolean).join(" · ") || undefined}
          metaIcon={expense.reminderDaysBefore != null ? "bell" : undefined}
          amount={amountText}
          caption={caption}
          captionTone={statusTone}
          isMuted={isInactive}
          onPress={onPress ?? (() => router.push({ pathname: "/expense/add", params: { id: expense.id } }))}
          accessibilityLabel={`${isCategoryTitle ? title : `${title}, ${expense.category}`}${accountName != null ? `, from ${accountName}` : ""}, ${amountText}, ${statusLabel}, ${dateText}`}
          accessibilityHint="Opens editor"
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={handleAccessibilityAction}
        />
      </Animated.View>
    </SwipeDeleteRow>
  );
}

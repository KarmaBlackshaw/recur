import React from "react";
import type { AccessibilityActionEvent } from "react-native";
import dayjs from "dayjs";
import { AppListRow } from "@/components/ui/AppListRow";
import { SwipeableRow, type SwipeAction } from "@/components/ui/SwipeableRow";
import { useLoans } from "@/context/LoanContext";
import { categoryIcon } from "@/utils/categories";
import { formatAmount } from "@/utils/formatAmount";
import {
  TRANSACTION_KIND_LABEL,
  type AccountTransaction,
  type AccountType,
  type FeatherIconName,
  type TransactionKind,
} from "@/types";

const KIND_ICON: Record<TransactionKind, FeatherIconName> = {
  payment: "shopping-bag",
  interest: "trending-up",
  tax: "percent",
  transfer: "repeat",
  fee: "scissors",
  adjust: "sliders",
  income: "arrow-down-left",
  loan_out: "arrow-up-right",
  loan_in: "arrow-down-left",
  reversal: "rotate-ccw",
};

interface Props {
  transaction: AccountTransaction;
  accountType: AccountType;
  reversal?: AccountTransaction;
  original?: AccountTransaction;
  onPress?: () => void;
  rightAction?: SwipeAction;
}

function titleOf(transaction: AccountTransaction, borrower: string | undefined) {
  if (borrower != null && transaction.kind === "loan_out") {
    return `Lent to ${borrower}`;
  }
  if (borrower != null && transaction.kind === "loan_in") {
    return `${borrower} repaid`;
  }
  if (borrower != null && transaction.kind === "income") {
    return `${TRANSACTION_KIND_LABEL.income} from ${borrower}`;
  }
  return TRANSACTION_KIND_LABEL[transaction.kind];
}

function reversalTitleOf(
  original: AccountTransaction | undefined,
  borrowerOf: (loanId: string | null) => string | undefined
) {
  if (!original) {
    return TRANSACTION_KIND_LABEL.reversal;
  }
  return `Reversal: ${titleOf(original, borrowerOf(original.loanId))}`;
}

export function TransactionRow({
  transaction,
  accountType,
  reversal,
  original,
  onPress,
  rightAction,
}: Props) {
  const { borrowerOf } = useLoans();
  const isReversal = transaction.kind === "reversal";
  const isReverted = reversal != null;
  const isInert = isReversal || isReverted;
  const title = isReversal
    ? reversalTitleOf(original, borrowerOf)
    : titleOf(transaction, borrowerOf(transaction.loanId));
  const source = isReversal ? original : transaction;
  const icon = isReversal
    ? categoryIcon(null, KIND_ICON.reversal)
    : categoryIcon(transaction.category, KIND_ICON[transaction.kind]);
  const isMoneyIn = accountType === "credit" ? transaction.amount < 0 : transaction.amount > 0;
  const signed = `${transaction.amount < 0 ? "−" : "+"}${formatAmount(Math.abs(transaction.amount))}`;
  const time = dayjs(transaction.createdAt).format("h:mm A");
  const meta = [source?.category, source?.note].filter(Boolean).join(" · ") || undefined;
  const caption = reversal != null ? `Reverted ${dayjs(reversal.createdAt).format("MMM D")}` : time;
  const details = [source?.category, source?.note, caption].filter(Boolean).join(", ");
  const rowAction = isInert ? undefined : rightAction;
  const rowPress = isInert ? undefined : onPress;

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    if (nativeEvent.actionName === "rightAction") {
      rowAction?.onPress();
    }
  }

  const row = (
    <AppListRow
      icon={icon}
      iconTone={isMoneyIn ? "positive" : "neutral"}
      title={title}
      meta={meta}
      amount={signed}
      amountTone={isMoneyIn ? "positive" : "neutral"}
      caption={caption}
      isMuted={isReverted}
      onPress={rowPress}
      accessibilityLabel={`${title}, ${signed}, ${details}`}
      accessibilityHint={rowPress ? "Opens details" : undefined}
      accessibilityActions={rowAction ? [{ name: "rightAction", label: rowAction.label }] : undefined}
      onAccessibilityAction={rowAction ? handleAccessibilityAction : undefined}
    />
  );

  if (!rowAction) {
    return row;
  }
  return <SwipeableRow rightAction={rowAction}>{row}</SwipeableRow>;
}

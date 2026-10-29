import React from "react";
import type { AccessibilityActionEvent } from "react-native";
import dayjs from "dayjs";
import { AppListRow } from "@/components/ui/AppListRow";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { useLoans } from "@/context/LoanContext";
import { categoryIcon } from "@/utils/categories";
import { formatAmount } from "@/utils/dateHelpers";
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
};

const DELETE_ACTIONS = [{ name: "delete", label: "Delete" }];

interface Props {
  transaction: AccountTransaction;
  accountType: AccountType;
  onPress?: () => void;
  // Swipe left (or the screen reader's Delete action) to remove it.
  onDelete?: () => void;
}

function titleOf(transaction: AccountTransaction, borrower: string | undefined) {
  if (borrower != null && transaction.kind === "loan_out") {
    return `Lent to ${borrower}`;
  }
  if (borrower != null && transaction.kind === "loan_in") {
    return `${borrower} repaid`;
  }
  return TRANSACTION_KIND_LABEL[transaction.kind];
}

export function TransactionRow({ transaction, accountType, onPress, onDelete }: Props) {
  const { loans } = useLoans();
  const borrower = transaction.loanId != null ? loans.find((l) => l.id === transaction.loanId)?.borrower : undefined;
  const title = titleOf(transaction, borrower);
  const icon = categoryIcon(transaction.category, KIND_ICON[transaction.kind]);
  const isMoneyIn = accountType === "credit" ? transaction.amount < 0 : transaction.amount > 0;
  const signed = `${transaction.amount < 0 ? "−" : "+"}${formatAmount(Math.abs(transaction.amount))}`;
  const time = dayjs(transaction.createdAt).format("h:mm A");
  const meta = [transaction.category, transaction.note].filter(Boolean).join(" · ") || undefined;
  const details = [transaction.category, transaction.note, time].filter(Boolean).join(", ");

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    if (nativeEvent.actionName === "delete") {
      onDelete?.();
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
      caption={time}
      onPress={onPress}
      accessibilityLabel={`${title}, ${signed}, ${details}`}
      accessibilityHint={onPress ? "Opens details" : undefined}
      accessibilityActions={onDelete ? DELETE_ACTIONS : undefined}
      onAccessibilityAction={onDelete ? handleAccessibilityAction : undefined}
    />
  );

  if (!onDelete) {
    return row;
  }
  return (
    <SwipeableRow rightAction={{ label: "Delete", icon: "trash-2", tone: "negative", onPress: onDelete }}>
      {row}
    </SwipeableRow>
  );
}

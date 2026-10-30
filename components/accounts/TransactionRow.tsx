import React from "react";
import { type AccessibilityActionEvent } from "react-native";
import dayjs from "dayjs";
import { AppListRow } from "@/components/ui/AppListRow";
import { SwipeDeleteRow } from "@/components/ui/SwipeDeleteRow";
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

interface Props {
  transaction: AccountTransaction;
  accountType: AccountType;
  onDelete?: () => void;
  onPress?: () => void;
}

export function TransactionRow({ transaction, accountType, onDelete, onPress }: Props) {
  const label = TRANSACTION_KIND_LABEL[transaction.kind];
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

  return (
    <SwipeDeleteRow onDelete={onDelete}>
      <AppListRow
        icon={icon}
        iconTone={isMoneyIn ? "positive" : "neutral"}
        title={label}
        meta={meta}
        amount={signed}
        amountTone={isMoneyIn ? "positive" : "neutral"}
        caption={time}
        onPress={onPress}
        accessibilityLabel={`${label}, ${signed}, ${details}`}
        accessibilityActions={onDelete ? [{ name: "delete", label: "Delete" }] : undefined}
        onAccessibilityAction={onDelete ? handleAccessibilityAction : undefined}
      />
    </SwipeDeleteRow>
  );
}

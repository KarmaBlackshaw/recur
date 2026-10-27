import React from "react";
import { type AccessibilityActionEvent } from "react-native";
import dayjs from "dayjs";
import { AppListRow, type RowTone } from "@/components/ui/AppListRow";
import { SwipeDeleteRow } from "@/components/ui/SwipeDeleteRow";
import { formatAmount } from "@/utils/dateHelpers";
import type { AccountTransaction, FeatherIconName } from "@/types";

interface TLoanHistoryBase {
  key: string;
  date: string;
  amount: number;
  accountName: string | undefined;
}

export type TLoanHistoryItem =
  | (TLoanHistoryBase & { kind: "lent" })
  | (TLoanHistoryBase & { kind: "interest" })
  | (TLoanHistoryBase & { kind: "payment"; txn: AccountTransaction });

const KIND_META: Record<TLoanHistoryItem["kind"], { icon: FeatherIconName; tone: RowTone; sign: string }> = {
  lent: { icon: "arrow-up-right", tone: "neutral", sign: "−" },
  interest: { icon: "trending-up", tone: "muted", sign: "" },
  payment: { icon: "arrow-down-left", tone: "positive", sign: "+" },
};

function labelOf({ kind, accountName }: TLoanHistoryItem) {
  const account = accountName ?? "Deleted account";
  switch (kind) {
    case "lent":
      return `Lent from ${account}`;
    case "interest":
      return "Interest";
    case "payment":
      return `Paid into ${account}`;
  }
}

export function LoanHistoryRow({ item, onDelete }: { item: TLoanHistoryItem; onDelete?: () => void }) {
  const { icon, tone, sign } = KIND_META[item.kind];
  const label = labelOf(item);
  const signed = `${sign}${formatAmount(item.amount)}`;
  const dateLabel = dayjs(item.date).format("MMM D");

  function handleAccessibilityAction({ nativeEvent }: AccessibilityActionEvent) {
    if (nativeEvent.actionName === "delete") {
      onDelete?.();
    }
  }

  return (
    <SwipeDeleteRow onDelete={onDelete}>
      <AppListRow
        icon={icon}
        iconTone={tone === "positive" ? "positive" : "neutral"}
        title={label}
        amount={signed}
        amountTone={tone}
        accessibilityLabel={`${label}, ${signed}, ${dateLabel}`}
        accessibilityActions={onDelete ? [{ name: "delete", label: "Delete" }] : undefined}
        onAccessibilityAction={onDelete ? handleAccessibilityAction : undefined}
      />
    </SwipeDeleteRow>
  );
}

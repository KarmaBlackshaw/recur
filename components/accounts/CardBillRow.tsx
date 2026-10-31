import React from "react";
import dayjs from "dayjs";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatDaysLate, formatDueDate } from "@/utils/dateHelpers";
import { formatAmount } from "@/utils/formatAmount";
import { isBillTbd } from "@/utils/cardBills";
import type { CardBill } from "@/types";

interface Props {
  bill: CardBill;
  onPress: () => void;
}

export function CardBillRow({ bill, onPress }: Props) {
  const isOverdue = !bill.isPaid && dayjs(bill.dueDate).isBefore(dayjs().startOf("day"));
  const isPartial = bill.paid > 0 && !bill.isPaid;
  const title = `${bill.account.name} bill`;
  const due = dayjs(bill.dueDate);
  const amountText = isBillTbd(bill) ? "TBD" : formatAmount(bill.amount);
  const leftText = `${formatAmount(bill.remaining)} left`;
  const dueText = isOverdue ? formatDaysLate(bill.dueDate) : formatDueDate(bill.dueDate);
  const detailText = [bill.isEstimate ? "Estimated" : null, isPartial ? leftText : null].filter(Boolean).join(" · ");
  const stateText = [isOverdue ? "overdue" : "unpaid", isPartial ? leftText : undefined]
    .filter(Boolean)
    .join(", ");
  const a11yLabel = `${title}, ${isBillTbd(bill) ? "amount to be determined" : `${amountText}${bill.isEstimate ? " estimated" : ""}`}, due ${due.format("MMMM D")}, ${stateText}`;

  return (
    <AppListRow
      icon="credit-card"
      iconTone={isOverdue ? "negative" : "accent"}
      title={title}
      meta={detailText || undefined}
      amount={amountText}
      caption={dueText}
      captionTone={isOverdue ? "negative" : "neutral"}
      onPress={onPress}
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens bill details"
    />
  );
}

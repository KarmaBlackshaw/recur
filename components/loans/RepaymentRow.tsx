import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { SwipeableRow } from "@/components/ui/SwipeableRow";
import { formatAmount } from "@/utils/formatAmount";
import { formatShortDate } from "@/utils/dates/formatShortDate";
import { useAccountNameOf } from "@/utils/accounts/useAccountNameOf";
import { repaymentLabels } from "@/utils/loans/repaymentLabels";
import type { TRepayment } from "@/types";

interface Props {
  repayment: TRepayment;
  onRevert: () => void;
}

export function RepaymentRow({ repayment, onRevert }: Props) {
  const labels = repaymentLabels(repayment, useAccountNameOf());
  const title = `Paid into ${labels.account}`;
  const meta = [labels.loans, labels.settled].filter(Boolean).join(" · ");
  const amount = `+${formatAmount(repayment.total)}`;
  const caption = [formatShortDate(repayment.paidAt), labels.extra].filter(Boolean).join(" · ");

  return (
    <SwipeableRow rightAction={{ label: "Revert", icon: "rotate-ccw", tone: "negative", onPress: onRevert }}>
      <AppListRow
        icon="arrow-down-left"
        iconTone="positive"
        title={title}
        meta={meta}
        amount={amount}
        amountTone="positive"
        caption={caption}
        accessibilityLabel={`${title}, ${amount}, ${meta}`}
      />
    </SwipeableRow>
  );
}

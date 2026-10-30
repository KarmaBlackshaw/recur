import React from "react";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/dateHelpers";
import type { BillPaymentEntry } from "@/utils/usePaidLedger";

interface Props {
  entry: BillPaymentEntry;
  onPress: () => void;
}

export function BillPaymentRow({ entry, onPress }: Props) {
  const { account, sourceName, amount, fee } = entry;
  const title = `${account.name} bill`;
  const source = sourceName ? `from ${sourceName}` : "Bill payment";
  const feeText = fee > 0 ? `fee ${formatAmount(fee)}` : null;

  return (
    <AppListRow
      icon="credit-card"
      iconTone="accent"
      title={title}
      meta={source}
      amount={formatAmount(amount)}
      caption={feeText ?? undefined}
      onPress={onPress}
      accessibilityLabel={`${title} payment, ${formatAmount(amount)}, ${[source, feeText].filter(Boolean).join(", ")}`}
      accessibilityHint="Opens payment details"
    />
  );
}

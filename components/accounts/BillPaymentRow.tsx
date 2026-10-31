import React from "react";
import { router } from "expo-router";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/formatAmount";
import type { BillPaymentEntry } from "@/utils/usePaidLedger";

interface Props {
  entry: BillPaymentEntry;
  onPress: () => void;
}

export function BillPaymentRow({ entry, onPress }: Props) {
  const { payment, account, sourceName, amount, fee } = entry;
  const title = `${account.name} bill`;
  const source = sourceName ? `from ${sourceName}` : "Bill payment";
  const feeText = fee > 0 ? `fee ${formatAmount(fee)}` : null;
  const { transferId } = payment;

  function open() {
    if (transferId) {
      onPress();
      return;
    }
    router.push({ pathname: "/account/[id]", params: { id: account.id } });
  }

  return (
    <AppListRow
      icon="credit-card"
      iconTone="accent"
      title={title}
      meta={source}
      amount={formatAmount(amount)}
      caption={feeText ?? undefined}
      onPress={open}
      accessibilityLabel={`${title} payment, ${formatAmount(amount)}, ${[source, feeText].filter(Boolean).join(", ")}`}
      accessibilityHint={transferId ? "Opens payment details" : "Opens account details"}
    />
  );
}

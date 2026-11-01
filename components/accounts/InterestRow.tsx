import React from "react";
import { router } from "expo-router";
import { AppListRow } from "@/components/ui/AppListRow";
import { formatAmount } from "@/utils/formatAmount";
import type { InterestEntry } from "@/utils/usePaidLedger";

export function InterestRow({ entry }: { entry: InterestEntry }) {
  const { interest, accountName, amount, tax } = entry;
  const meta = [accountName, tax > 0 ? `tax ${formatAmount(tax)}` : null].filter(Boolean).join(" · ") || "Interest";
  const signed = `+${formatAmount(amount)}`;

  return (
    <AppListRow
      icon="trending-up"
      iconTone="positive"
      title="Interest"
      meta={meta}
      amount={signed}
      amountTone="positive"
      onPress={() => router.push({ pathname: "/account/[id]", params: { id: interest.accountId } })}
      accessibilityLabel={`Interest, ${signed}, ${meta}`}
      accessibilityHint="Opens account details"
    />
  );
}

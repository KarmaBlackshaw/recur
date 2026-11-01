import React from "react";
import { View } from "react-native";
import { formatAmount } from "@/utils/formatAmount";
import { useAccounts } from "@/context/AccountContext";
import { useMonthTotals } from "@/utils/useMonthTotals";
import { KpiCard } from "@/components/kpi/KpiCard";

interface Props {
  year: number;
  month: number;
  recurringOnly?: boolean;
}

export function KpiRow({ year, month, recurringOnly = false }: Props) {
  const { accounts } = useAccounts();
  const { total, paid, unpaid, charged } = useMonthTotals(year, month, recurringOnly);
  // "Charged" only means something once there's a credit card to charge.
  const hasCards = accounts.some((a) => a.type === "credit");
  const totalTile = (
    <KpiCard label={recurringOnly ? "Bills" : "Total"} value={formatAmount(total)} tone="primary" icon="wallet-outline" />
  );
  const paidTile = <KpiCard label="Paid" value={formatAmount(paid)} tone="paid" icon="checkmark-circle-outline" />;
  const toPayTile = <KpiCard label="To pay" value={formatAmount(unpaid)} tone="neutral" icon="time-outline" />;

  if (!hasCards) {
    return (
      <View className="px-5 py-2 flex-row gap-2.5">
        {totalTile}
        {paidTile}
        {toPayTile}
      </View>
    );
  }

  return (
    <View className="px-5 py-2 gap-2.5">
      <View className="flex-row gap-2.5">
        {totalTile}
        {paidTile}
      </View>
      <View className="flex-row gap-2.5">
        <KpiCard label="Charged" value={formatAmount(charged)} tone="charged" icon="card-outline" />
        {toPayTile}
      </View>
    </View>
  );
}

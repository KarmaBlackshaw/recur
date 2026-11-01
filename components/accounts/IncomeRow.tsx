import React from "react";
import { router } from "expo-router";
import { AppListRow } from "@/components/ui/AppListRow";
import { useAccounts } from "@/context/AccountContext";
import { incomeTitle } from "@/utils/accounts/incomeTitle";
import { categoryIcon } from "@/utils/categories";
import { formatAmount } from "@/utils/dateHelpers";
import type { IncomeEntry } from "@/utils/usePaidLedger";

export function IncomeRow({ entry }: { entry: IncomeEntry }) {
  const { accounts } = useAccounts();
  const { income } = entry;
  const title = incomeTitle(entry);
  const accountName = accounts.find(({ id }) => id === income.accountId)?.name;
  const meta = [accountName, income.note].filter(Boolean).join(" · ") || "Income";
  const signed = `+${formatAmount(income.amount)}`;

  return (
    <AppListRow
      icon={categoryIcon(income.category, "arrow-down-left")}
      iconTone="positive"
      title={title}
      meta={meta}
      amount={signed}
      amountTone="positive"
      onPress={() => router.push({ pathname: "/income/add", params: { id: income.id } })}
      accessibilityLabel={`${title}, ${signed}, ${meta}`}
      accessibilityHint="Edits this income"
    />
  );
}

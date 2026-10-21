import React from "react";
import { router } from "expo-router";
import { ExpenseCard } from "@/components/ExpenseCard";
import { BillPaymentRow } from "@/components/accounts/BillPaymentRow";
import { IncomeRow } from "@/components/accounts/IncomeRow";
import { TransferRow } from "@/components/accounts/TransferRow";
import { LoanActivityRow } from "@/components/loans/LoanActivityRow";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";

interface Props {
  item: ActivityEntry;
  index: number;
}

export function ActivityEntryRow({ item, index }: Props) {
  if ("income" in item) {
    return <IncomeRow entry={item} />;
  }
  if ("transfer" in item) {
    return <TransferRow entry={item} />;
  }
  if ("loanTxn" in item) {
    return <LoanActivityRow entry={item} />;
  }
  if ("payment" in item) {
    return <BillPaymentRow entry={item} />;
  }
  return (
    <ExpenseCard
      expense={item.expense}
      index={index}
      compact={item.compact}
      hideDate={item.hideDate}
      referenceDate={item.refDate}
      onPress={() =>
        router.push({
          pathname: "/expense/add",
          params: {
            id: item.expense.id,
            year: item.refDate.getFullYear(),
            month: item.refDate.getMonth(),
          },
        })
      }
    />
  );
}

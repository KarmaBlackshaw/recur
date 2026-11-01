import React from "react";
import { ExpenseCard } from "@/components/ExpenseCard";
import { BillPaymentRow } from "@/components/accounts/BillPaymentRow";
import { IncomeRow } from "@/components/accounts/IncomeRow";
import { InterestRow } from "@/components/accounts/InterestRow";
import { TransferRow } from "@/components/accounts/TransferRow";
import { LoanActivityRow } from "@/components/loans/LoanActivityRow";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { AccountTransaction } from "@/types";

interface Props {
  item: ActivityEntry;
  index: number;
  onOpenTransfer: (transfer: AccountTransaction) => void;
  onOpenLoan: (txn: AccountTransaction) => void;
}

export function ActivityEntryRow({ item, index, onOpenTransfer, onOpenLoan }: Props) {
  if ("income" in item) {
    return <IncomeRow entry={item} />;
  }
  if ("interest" in item) {
    return <InterestRow entry={item} />;
  }
  if ("transfer" in item) {
    return <TransferRow entry={item} onPress={() => onOpenTransfer(item.transfer)} />;
  }
  if ("loanTxn" in item) {
    return <LoanActivityRow entry={item} onPress={() => onOpenLoan(item.loanTxn)} />;
  }
  if ("payment" in item) {
    return <BillPaymentRow entry={item} onPress={() => onOpenTransfer(item.payment)} />;
  }
  return (
    <ExpenseCard
      expense={item.expense}
      index={index}
      compact={item.compact}
      hideDate={item.hideDate}
      referenceDate={item.refDate}
      canQuickPay={item.canQuickPay}
      isSwipeHintShown={item.isSwipeHintShown}
    />
  );
}

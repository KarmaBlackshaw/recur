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

export function ActivityEntryRow({ item, index, onOpenTransfer, onOpenLoan }: Props): React.JSX.Element {
  switch (item.kind) {
    case "income":
      return <IncomeRow entry={item} />;
    case "interest":
      return <InterestRow entry={item} />;
    case "transfer":
      return <TransferRow entry={item} onPress={() => onOpenTransfer(item.transfer)} />;
    case "loan":
      return <LoanActivityRow entry={item} onPress={() => onOpenLoan(item.loanTxn)} />;
    case "billPayment":
      return <BillPaymentRow entry={item} onPress={() => onOpenTransfer(item.payment)} />;
    case "expense":
      return (
        <ExpenseCard
          expense={item.expense}
          index={index}
          compact={item.compact}
          hideDate={item.hideDate}
          referenceDate={item.refDate}
          canOpenBillSheet={item.canOpenBillSheet}
          isSwipeHintShown={item.isSwipeHintShown}
        />
      );
  }
}

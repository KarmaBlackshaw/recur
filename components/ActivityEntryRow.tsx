import React from "react";
import { router } from "expo-router";
import { ExpenseCard } from "@/components/ExpenseCard";
import { BillPaymentRow } from "@/components/accounts/BillPaymentRow";
import { IncomeRow } from "@/components/accounts/IncomeRow";
import { InterestRow } from "@/components/accounts/InterestRow";
import { TransferRow } from "@/components/accounts/TransferRow";
import { LoanActivityRow } from "@/components/loans/LoanActivityRow";
import { RepaymentActivityRow } from "@/components/loans/RepaymentActivityRow";
import type { SharedValue } from "react-native-reanimated";
import type { ActivityEntry } from "@/components/DayGroupedExpenseList";
import type { AccountTransaction } from "@/types";
import type { RepaymentActivityEntry } from "@/utils/useLoanActivity";

function repaymentPress(
  { repayment: { borrower, payments, excess } }: RepaymentActivityEntry,
  onOpenLoan: (txn: AccountTransaction) => void
): (() => void) | undefined {
  if (!borrower) {
    return undefined;
  }
  if (payments.length === 1 && !excess) {
    return () => onOpenLoan(payments[0].txn);
  }
  return () => router.push({ pathname: "/loan/borrower", params: { name: borrower } });
}

interface Props {
  item: ActivityEntry;
  index: number;
  swipeEnabled?: SharedValue<boolean>;
  onOpenTransfer: (transfer: AccountTransaction) => void;
  onOpenLoan: (txn: AccountTransaction) => void;
}

export function ActivityEntryRow({ item, index, swipeEnabled, onOpenTransfer, onOpenLoan }: Props): React.JSX.Element {
  switch (item.kind) {
    case "income":
      return <IncomeRow entry={item} />;
    case "interest":
      return <InterestRow entry={item} />;
    case "transfer":
      return <TransferRow entry={item} onPress={() => onOpenTransfer(item.transfer)} />;
    case "loan":
      return <LoanActivityRow entry={item} onPress={() => onOpenLoan(item.loanTxn)} />;
    case "repayment":
      return <RepaymentActivityRow entry={item} onPress={repaymentPress(item, onOpenLoan)} />;
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
          paidTxn={item.paidTxn}
          swipeEnabled={swipeEnabled}
        />
      );
  }
}

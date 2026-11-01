import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import dayjs from "dayjs";
import { router } from "expo-router";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { AppBottomSheet, CONTENT_HEIGHT_SNAP, type AppBottomSheetRef } from "@/components/ui/AppBottomSheet";
import { AppButton } from "@/components/ui/AppButton";
import { AppDetailRow } from "@/components/ui/AppDetailRow";
import { formatAmount } from "@/utils/formatAmount";
import { formatLoanInterest } from "@/utils/loans/formatLoanInterest";
import { useRevertLoan } from "@/utils/loans/useRevertLoan";
import type { TLoanSummary } from "@/utils/loans/summarizeLoan";
import type { AccountTransaction, Loan } from "@/types";

export interface LoanSheetRef {
  present: (txn: AccountTransaction) => void;
}

interface Snapshot {
  txn: AccountTransaction;
  loan: Loan;
  summary: TLoanSummary;
  accountName: string;
}

export const LoanSheet = forwardRef<LoanSheetRef>(function LoanSheet(_props, ref) {
  const sheetRef = useRef<AppBottomSheetRef>(null);
  const loans = useLoans();
  const accounts = useAccounts();
  const revertLoan = useRevertLoan();
  const [snapshot, setSnapshot] = useState<Snapshot>();

  useImperativeHandle(ref, () => ({
    present: (txn) => {
      const loan = loans.loans.find(({ id }) => id === txn.loanId);
      if (!loan) {
        return;
      }
      const accountName = accounts.accounts.find(({ id }) => id === txn.accountId)?.name ?? "Deleted account";
      setSnapshot({ txn, loan, summary: loans.summaries[loan.id], accountName });
      sheetRef.current?.present();
    },
  }));

  const isPayment = snapshot?.txn.kind === "loan_in";

  function handleRecordPayment({ loan }: Snapshot) {
    sheetRef.current?.dismiss();
    router.push({ pathname: "/loan/pay", params: { id: loan.id } });
  }

  function handleEdit({ txn, loan }: Snapshot) {
    sheetRef.current?.dismiss();
    if (txn.kind === "loan_in") {
      router.push({ pathname: "/loan/pay", params: { id: loan.id, paymentId: txn.id } });
      return;
    }
    router.push({ pathname: "/loan/add", params: { id: loan.id } });
  }

  function handleRevert({ txn }: Snapshot) {
    revertLoan(txn, (revert) => sheetRef.current?.dismiss(revert));
  }

  return (
    <AppBottomSheet ref={sheetRef} title={isPayment ? "Loan payment" : "Loan"} snapPoints={CONTENT_HEIGHT_SNAP}>
      {snapshot ? (
        <View className="px-4 pb-4">
          <AppDetailRow label="Borrower" value={snapshot.loan.borrower} />
          <AppDetailRow label="Amount" value={formatAmount(Math.abs(snapshot.txn.amount))} />
          <AppDetailRow label={isPayment ? "To" : "From"} value={snapshot.accountName} />
          <AppDetailRow label="Date" value={dayjs(snapshot.txn.createdAt).format("MMM D, YYYY")} />
          {!isPayment && snapshot.loan.interest.type !== "none" ? (
            <AppDetailRow label="Interest" value={formatLoanInterest(snapshot.loan.interest)} />
          ) : null}
          {snapshot.summary.isSettled ? (
            <AppDetailRow label="Collected" value={formatAmount(snapshot.summary.paidTotal)} />
          ) : (
            <AppDetailRow label="Still owed" value={formatAmount(snapshot.summary.balance)} />
          )}
          {snapshot.loan.note ? <AppDetailRow label="Note" value={snapshot.loan.note} /> : null}
          <View className="mt-4 gap-2">
            {snapshot.summary.isSettled ? null : (
              <AppButton label="Record payment" onPress={() => handleRecordPayment(snapshot)} />
            )}
            <AppButton
              label={isPayment ? "Edit payment" : "Edit loan"}
              variant="tonal"
              onPress={() => handleEdit(snapshot)}
            />
            <AppButton
              label={isPayment ? "Revert payment" : "Revert loan"}
              variant="destructive"
              onPress={() => handleRevert(snapshot)}
            />
          </View>
        </View>
      ) : null}
    </AppBottomSheet>
  );
});

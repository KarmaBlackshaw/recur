import { Alert } from "react-native";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { deleteLoanMessage } from "@/utils/loans/deleteLoanMessage";
import type { AccountTransaction } from "@/types";

export function useRevertLoan() {
  const loans = useLoans();
  const accounts = useAccounts();

  return (txn: AccountTransaction, runAction: (revert: () => Promise<void>) => void = (revert) => revert()) => {
    const loan = loans.loans.find(({ id }) => id === txn.loanId);
    if (!loan) {
      return;
    }
    const isPayment = txn.kind === "loan_in";
    const accountName = accounts.accounts.find(({ id }) => id === txn.accountId)?.name ?? "its account";
    const message = isPayment
      ? `The money leaves ${accountName} and ${loan.borrower} owes it again.`
      : deleteLoanMessage({
          loan,
          paymentCount: loans.paymentsOf(loan.id).length,
          incomeCount: loans.incomeOf(loan.id).length,
          accountName,
        });

    const revert = async () => {
      try {
        if (isPayment) {
          await loans.deletePayment(txn.id);
        } else {
          await loans.deleteLoan(loan.id);
        }
      } catch (e) {
        console.error(isPayment ? "Revert payment failed" : "Revert loan failed", e);
        alertFailure("Revert failed", e);
      }
    };

    Alert.alert(isPayment ? "Revert payment?" : "Revert loan?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Revert", style: "destructive", onPress: () => runAction(revert) },
    ]);
  };
}

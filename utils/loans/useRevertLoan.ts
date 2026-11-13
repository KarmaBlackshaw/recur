import { Alert } from "react-native";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { revertLoanMessage } from "@/utils/loans/revertLoanMessage";
import { staysInHistory } from "@/utils/loans/staysInHistory";
import type { AccountTransaction } from "@/types";

export function useRevertLoan() {
  const loans = useLoans();
  const { nameOf } = useAccounts();

  return (txn: AccountTransaction, runAction: (revert: () => Promise<void>) => void = (revert) => revert()) => {
    const loan = loans.loans.find(({ id }) => id === txn.loanId);
    if (!loan) {
      return;
    }
    const isPayment = txn.kind === "loan_in";
    const message = isPayment
      ? `The money leaves ${nameOf(txn.accountId)} and ${loan.borrower} owes it again. ${staysInHistory("The payment")}`
      : revertLoanMessage({
          loan,
          paymentCount: loans.paymentsOf(loan.id).length,
          incomeCount: loans.incomeOf(loan.id).length,
          accountNameOf: nameOf,
        });

    const revert = async () => {
      try {
        if (isPayment) {
          await loans.revertPayment(txn.id);
        } else {
          await loans.revertLoan(loan.id);
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

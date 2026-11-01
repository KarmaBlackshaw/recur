import { Alert } from "react-native";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { countLabel } from "@/utils/countLabel";
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
    const paymentCount = loans.paymentsOf(loan.id).length;
    const message = isPayment
      ? `The money leaves ${accountName} and ${loan.borrower} owes it again.`
      : paymentCount > 0
        ? `This loan and its ${countLabel(paymentCount, "payment", "payments")} are removed, and account balances go back.`
        : `This loan is removed and the money goes back to ${accountName}.`;

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

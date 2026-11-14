import { Alert } from "react-native";
import dayjs from "dayjs";
import { useAccounts } from "@/context/AccountContext";
import { useLoans } from "@/context/LoanContext";
import { alertFailure } from "@/utils/accounts/alertFailure";
import { sumBy } from "@/utils/collections";
import { repaymentLabels } from "@/utils/loans/repaymentLabels";
import { revertRepaymentMessage } from "@/utils/loans/revertRepaymentMessage";
import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import { round } from "@/utils/round";
import { useToday } from "@/utils/useToday";
import type { TRepayment } from "@/types";

export function useRevertRepayment(): (repayment: TRepayment) => void {
  const loans = useLoans();
  const { nameOf } = useAccounts();
  const todayDate = useToday();
  const today = dayjs(todayDate).format("YYYY-MM-DD");

  return (repayment) => {
    const { borrower } = repayment;
    if (borrower == null) {
      return;
    }
    const revertedIds = new Set(repayment.payments.map(({ txn }) => txn.id));
    const owed = round(
      sumBy(
        loans.loans.filter((loan) => loan.borrower === borrower),
        (loan) =>
          summarizeLoan({
            loan,
            payments: loans.paymentsOf(loan.id).filter(({ id }) => !revertedIds.has(id)),
            today,
          }).balance
      ),
      2
    );
    const { account } = repaymentLabels(repayment, nameOf);
    const { title, message } = revertRepaymentMessage({
      repayment,
      borrower,
      accountLabel: account,
      owesAgain: owed > 0 ? owed : undefined,
    });

    const revert = async () => {
      try {
        await loans.revertRepayment(repayment.id);
      } catch (e) {
        console.error("Revert repayment failed", e);
        alertFailure("Revert failed", e);
      }
    };

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Revert", style: "destructive", onPress: revert },
    ]);
  };
}

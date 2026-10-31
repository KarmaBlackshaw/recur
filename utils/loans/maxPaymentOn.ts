import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import type { TLoanPayment, TLoanTerms } from "@/types";

// Paying earlier also trims the monthly interest charged after that date, so a backdated payment can settle the loan
// for less than today's balance.
export function maxPaymentOn({ loan, payments, paidAt, today }: {
  loan: TLoanTerms;
  payments: TLoanPayment[];
  paidAt: string;
  today: string;
}) {
  const canFit = (cents: number) => {
    const { isValid } = summarizeLoan({
      loan,
      payments: [...payments, { amount: cents / 100, createdAt: paidAt }],
      today,
    });
    return isValid;
  };
  const { balance } = summarizeLoan({ loan, payments, today });
  let low = 0;
  let high = Math.max(0, Math.round(balance * 100));
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (canFit(mid)) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low / 100;
}

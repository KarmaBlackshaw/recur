import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import type { TLoanPayment, TLoanTerms } from "@/types";

// The least amount that settles the loan when paid on `paidAt`: paying earlier also trims the monthly interest charged
// after that date, so a backdated payment can settle it for less than today's balance. When no amount lands on ₱0
// (the interest it stops is more than a later payment covers), that later payment is left overpaying.
export function maxPaymentOn({ loan, payments, paidAt, today }: {
  loan: TLoanTerms;
  payments: TLoanPayment[];
  paidAt: string;
  today: string;
}) {
  const settles = (cents: number) => {
    const { isSettled, isValid } = summarizeLoan({
      loan,
      payments: [...payments, { amount: cents / 100, createdAt: paidAt }],
      today,
    });
    return isValid && isSettled;
  };
  const { balance } = summarizeLoan({ loan, payments, today });
  let high = Math.round(balance * 100);
  if (!settles(high)) {
    return 0;
  }
  let low = 0;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (settles(mid)) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return high / 100;
}

import { canChangeLoan } from "@/utils/loans/canChangeLoan";
import { maxPaymentOn } from "@/utils/loans/maxPaymentOn";
import type { TLoanPayment, TLoanTerms } from "@/types";

// An edited payment can go up to what a new payment on its date could, or keep paying past what the loan owed (a
// payment dated after a backdated payoff), as long as the edit doesn't overpay by more.
export function canEditPayment({ loan, payments, id, next, today }: {
  loan: TLoanTerms;
  payments: (TLoanPayment & { id: string })[];
  id: string;
  next: TLoanPayment;
  today: string;
}) {
  const others = payments.filter((p) => p.id !== id);
  return (
    next.amount <= maxPaymentOn({ loan, payments: others, paidAt: next.createdAt, today }) ||
    canChangeLoan({ current: { loan, payments }, next: { loan, payments: [...others, next] }, today })
  );
}

import { paymentLeavesClause, type TPaymentRemoval } from "@/utils/loans/paymentLeavesClause";

export function deletePaymentMessage(removal: TPaymentRemoval): string {
  const clause = paymentLeavesClause(removal);
  return removal.excess ? `${clause}. Both are deleted.` : `${clause}.`;
}

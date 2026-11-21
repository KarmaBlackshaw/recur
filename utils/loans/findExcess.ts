import type { AccountTransaction, TRepayment } from "@/types";

// The Overpayment income saved by the same Record payment as this payment.
export function findExcess(repayments: TRepayment[], paymentId: string): AccountTransaction | undefined {
  return repayments.find(({ payments }) => payments.some(({ txn }) => txn.id === paymentId))?.excess;
}

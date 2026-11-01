import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import type { Loan, TLoanPayment } from "@/types";

export interface TLoanPaymentTarget {
  loan: Loan;
  payments: TLoanPayment[];
  cap: number;
}

export interface TLoanPaymentPart {
  loan: Loan;
  share: number;
  balanceAfter: number;
  isSettled: boolean;
}

export interface TLoanPaymentSplit {
  parts: TLoanPaymentPart[];
  total: number;
  unplaced: number;
}

export function splitLoanPayment({ amount, targets, paidAt, today }: {
  amount: number;
  targets: TLoanPaymentTarget[];
  paidAt: string;
  today: string;
}): TLoanPaymentSplit {
  const amountCents = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
  let remaining = amountCents;
  let totalCents = 0;
  const parts: TLoanPaymentPart[] = [];
  for (const { loan, payments, cap } of targets) {
    const capCents = Math.round(cap * 100);
    const shareCents = Math.min(remaining, capCents);
    remaining -= shareCents;
    totalCents += capCents;
    const share = shareCents / 100;
    const after = summarizeLoan({
      loan,
      payments: shareCents > 0 ? [...payments, { amount: share, createdAt: paidAt }] : payments,
      today,
    });
    parts.push({ loan, share, balanceAfter: after.balance, isSettled: after.isSettled });
  }
  return { parts, total: totalCents / 100, unplaced: remaining / 100 };
}

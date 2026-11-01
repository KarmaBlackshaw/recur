import { summarizeLoan } from "@/utils/loans/summarizeLoan";
import type { TLoanPayment, TLoanTerms } from "@/types";

interface TLoanState { loan: TLoanTerms; payments: TLoanPayment[] }

// A change can't leave the payments paying more than the loan owes, beyond what they already overpaid.
export function canChangeLoan({ current, next, today }: { current: TLoanState; next: TLoanState; today: string }) {
  const candidate = summarizeLoan({ ...next, today });
  return candidate.isValid && candidate.overpaid <= summarizeLoan({ ...current, today }).overpaid;
}

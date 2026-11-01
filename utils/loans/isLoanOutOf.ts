import type { AccountTransaction } from "@/types";

export function isLoanOutOf(loanId: string) {
  return (t: AccountTransaction) => t.loanId === loanId && t.kind === "loan_out";
}

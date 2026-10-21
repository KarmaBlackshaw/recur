import type { TLoanInterest, TLoanInterestType } from "@/types";

export function fromLoanInterest(interest: TLoanInterest): { type: TLoanInterestType; value: number | null } {
  switch (interest.type) {
    case "none":
      return { type: interest.type, value: null };
    case "fixed":
      return { type: interest.type, value: interest.amount };
    case "percent_once":
    case "monthly_principal":
    case "monthly_balance":
      return { type: interest.type, value: interest.rate };
  }
}

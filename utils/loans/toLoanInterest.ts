import type { TLoanInterest, TLoanInterestType } from "@/types";

export function toLoanInterest(type: TLoanInterestType, value: number | null): TLoanInterest {
  switch (type) {
    case "none":
      return { type };
    case "fixed":
      return { type, amount: value ?? 0 };
    case "percent_once":
    case "monthly_principal":
    case "monthly_balance":
      return { type, rate: value ?? 0 };
  }
}

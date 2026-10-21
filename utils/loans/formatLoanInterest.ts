import { type TLoanInterest } from "@/types";
import { formatAmount } from "@/utils/dateHelpers";

export function formatLoanInterest(interest: TLoanInterest): string {
  switch (interest.type) {
    case "none":
      return "No interest";
    case "fixed":
      return `${formatAmount(interest.amount)} fixed`;
    case "percent_once":
      return `${interest.rate}% once`;
    case "monthly_principal":
      return `${interest.rate}%/mo`;
    case "monthly_balance":
      return `${interest.rate}%/mo on bal.`;
  }
}

import { formatAmount } from "@/utils/dateHelpers";
import type { TOverdraft } from "@/utils/accounts/findOverdraft";

export class OverdraftError extends Error {
  constructor({ account, shortfall }: TOverdraft) {
    super(`Not enough in ${account.name}, ${formatAmount(shortfall)} short. Transfer money in first.`);
    this.name = "OverdraftError";
  }
}

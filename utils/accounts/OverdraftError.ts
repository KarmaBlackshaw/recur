import { formatAmount } from "@/utils/dateHelpers";
import type { TOverdraft } from "@/utils/accounts/findOverdraft";
import type { Account } from "@/types";

export class OverdraftError extends Error {
  readonly account: Account;
  readonly shortfall: number;

  constructor({ account, shortfall }: TOverdraft) {
    super(`Not enough in ${account.name}, ${formatAmount(shortfall)} short. Transfer money in first.`);
    this.name = "OverdraftError";
    this.account = account;
    this.shortfall = shortfall;
  }
}

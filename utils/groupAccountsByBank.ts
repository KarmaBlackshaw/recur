import { findBank, type BankId } from "@/constants/banks";
import type { Account, AccountBankGroup } from "@/types";

// Banks keep the order of their first account; accounts without a bank go last.
export function groupAccountsByBank(accounts: readonly Account[]): AccountBankGroup[] {
  const byBank = new Map<BankId, Account[]>();
  const other: Account[] = [];
  for (const account of accounts) {
    if (account.bank == null) {
      other.push(account);
      continue;
    }
    byBank.set(account.bank, [...(byBank.get(account.bank) ?? []), account]);
  }
  const groups: AccountBankGroup[] = [...byBank].map(([key, members]) => ({
    key,
    label: findBank(key)?.name ?? key,
    accounts: members,
  }));
  if (other.length > 0) {
    groups.push({ key: "other", label: "Other", accounts: other });
  }
  return groups;
}

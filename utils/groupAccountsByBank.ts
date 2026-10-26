import { BANKS, findBank, type BankId } from "@/constants/banks";
import type { Account, AccountBankGroup } from "@/types";

// `account.bank` is only set when the card uses a bank template, so custom-styled
// cards fall back to a whole-word match of the account name ("BPI Savings" → bpi).
function inferBankId(account: Pick<Account, "bank" | "name">): BankId | null {
  if (account.bank != null) {
    return account.bank;
  }
  const words = account.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const runs = words.flatMap((_, start) => [1, 2].map((size) => words.slice(start, start + size).join("")));
  return BANKS.find((bank) => runs.includes(bank.id))?.id ?? null;
}

// Banks keep the order of their first account; accounts without a bank go last.
export function groupAccountsByBank(accounts: readonly Account[]): AccountBankGroup[] {
  const byBank = new Map<BankId, Account[]>();
  const other: Account[] = [];
  for (const account of accounts) {
    const bankId = inferBankId(account);
    if (bankId == null) {
      other.push(account);
      continue;
    }
    byBank.set(bankId, [...(byBank.get(bankId) ?? []), account]);
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

import { reversedIds } from "@/utils/reversals/reversedIds";
import type { AccountTransaction } from "@/types";

export function inEffectTransactions(ledger: AccountTransaction[]): AccountTransaction[] {
  const reverted = reversedIds(ledger);
  return ledger.filter(({ id, kind }) => kind !== "reversal" && !reverted.has(id));
}

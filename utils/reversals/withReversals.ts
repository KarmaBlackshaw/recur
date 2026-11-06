import type { AccountTransaction } from "@/types";

export function withReversals(ledger: AccountTransaction[], ids: Iterable<string>): Set<string> {
  const result = new Set(ids);
  for (const { id, kind, reversesId } of ledger) {
    if (kind === "reversal" && reversesId != null && result.has(reversesId)) {
      result.add(id);
    }
  }
  return result;
}

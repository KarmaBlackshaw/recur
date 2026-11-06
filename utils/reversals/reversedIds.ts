import type { AccountTransaction } from "@/types";

export function reversedIds(ledger: AccountTransaction[]): Set<string> {
  const ids = new Set<string>();
  for (const { kind, reversesId } of ledger) {
    if (kind === "reversal" && reversesId != null) {
      ids.add(reversesId);
    }
  }
  return ids;
}

import dayjs from "dayjs";
import { round } from "@/utils/round";
import type { AccountTransaction } from "@/types";

export function buildReversal(original: AccountTransaction, now: string): Omit<AccountTransaction, "id"> {
  if (original.kind === "reversal") {
    throw new Error("A reversal can't be reversed");
  }
  const isNowBeforeOriginal = dayjs(now).isBefore(dayjs(original.createdAt));
  return {
    accountId: original.accountId,
    kind: "reversal",
    amount: round(-original.amount, 2),
    expenseId: original.expenseId,
    cycleYear: original.cycleYear,
    cycleMonth: original.cycleMonth,
    transferId: original.transferId,
    note: null,
    category: null,
    loanId: original.loanId,
    reversesId: original.id,
    createdAt: isNowBeforeOriginal ? original.createdAt : now,
  };
}

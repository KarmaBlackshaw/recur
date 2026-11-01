import dayjs from "dayjs";
import { formatAmount } from "@/utils/formatAmount";
import type { Loan } from "@/types";

export function loanTitle({ note, principal, lentAt }: Loan) {
  return note?.trim() || `${formatAmount(principal)} · ${dayjs(lentAt).format("MMM D")}`;
}

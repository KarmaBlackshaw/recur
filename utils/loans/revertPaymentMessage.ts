import { paymentLeavesClause, type TPaymentRemoval } from "@/utils/loans/paymentLeavesClause";
import { staysInHistory } from "@/utils/loans/staysInHistory";

export function revertPaymentMessage(removal: TPaymentRemoval): string {
  const stays = removal.excess ? staysInHistory("Both", true) : staysInHistory("The payment");
  return `${paymentLeavesClause(removal)}. ${stays}`;
}

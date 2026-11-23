import type { Account } from "@/types";
import { mentionsBank, type ParsedSms } from "@/utils/sms/parseTransactionSms";

// The account a shared SMS is about, from the bank it names and the card or account digits it ends with.
export function guessAccount(sms: ParsedSms, accounts: Account[]): string | null {
  const { bank, lastDigits } = sms;
  const ofBank = bank ? accounts.filter((a) => a.bank === bank || (a.bank == null && mentionsBank(a.name, bank))) : [];
  const byDigits = lastDigits ? (ofBank.length > 0 ? ofBank : accounts).filter((a) => a.name.includes(lastDigits)) : [];
  if (byDigits.length === 1) {
    return byDigits[0].id;
  }
  const isCardCharge = sms.direction === "expense" && sms.isCard;
  return (ofBank.find((a) => (a.type === "credit") === isCardCharge) ?? ofBank[0])?.id ?? null;
}

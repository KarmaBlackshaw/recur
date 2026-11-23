import { parseTransactionSms } from "@/utils/sms/parseTransactionSms";

// Long enough for any bank SMS or notification, short enough to keep the link small.
const MAX_SHARED_LENGTH = 1000;

// The form a shared SMS opens. It carries the text itself, so the form reads it with the user's accounts at hand.
export function smsShareHref(text: string): string {
  const sms = encodeURIComponent(text.trim().slice(0, MAX_SHARED_LENGTH));
  return parseTransactionSms(text).direction === "income"
    ? `/income/add?sms=${sms}`
    : `/expense/add?type=regular&sms=${sms}`;
}

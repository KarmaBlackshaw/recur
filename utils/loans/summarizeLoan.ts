import dayjs from "dayjs";
import type { TLoanPayment, TLoanTerms } from "@/types";

export interface TLoanCharge { date: string; amount: number }
export interface TLoanOverpayment<P extends TLoanPayment = TLoanPayment> { payment: P; amount: number }
export interface TLoanSummary<P extends TLoanPayment = TLoanPayment> {
  balance: number;
  interestTotal: number;
  paidTotal: number;
  charges: TLoanCharge[];
  overpayments: TLoanOverpayment<P>[];
  overpaid: number;
  isSettled: boolean;
  settledAt: string | null;
  isValid: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const day = (d: string) => dayjs(d).format("YYYY-MM-DD");

// Charges and payments apply in date order. The balance stops at ₱0, where interest stops too: the part of a payment
// past that point is an overpayment of that payment, not a negative balance.
export function summarizeLoan<P extends TLoanPayment>({ loan, payments, today }: {
  loan: TLoanTerms;
  payments: P[];
  today: string;
}): TLoanSummary<P> {
  const { principal, lentAt, interest } = loan;
  const lentDay = day(lentAt);
  const queue = payments
    .map((payment) => ({ payment, day: day(payment.createdAt) }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const charges: TLoanCharge[] = [];
  const overpayments: TLoanOverpayment<P>[] = [];
  let balance = round2(principal);
  let paid = 0;
  let settledAt: string | null = null;

  const applyPaymentsBefore = (limit?: string) => {
    while (queue.length > 0 && (limit == null || queue[0].day < limit)) {
      const next = queue.shift();
      if (next == null) {
        return;
      }
      const { payment } = next;
      const applied = Math.min(payment.amount, balance);
      const excess = round2(payment.amount - applied);
      balance = round2(balance - applied);
      paid += payment.amount;
      if (excess > 0) {
        overpayments.push({ payment, amount: excess });
      }
      if (balance <= 0 && settledAt == null) {
        settledAt = next.day;
      }
    }
  };

  const charge = (date: string, amount: number) => {
    const rounded = round2(amount);
    charges.push({ date, amount: rounded });
    balance = round2(balance + rounded);
  };

  // Interest due on a day is charged before that same day's payments.
  switch (interest.type) {
    case "none":
      break;
    case "fixed":
      charge(lentDay, interest.amount);
      break;
    case "percent_once":
      charge(lentDay, (principal * interest.rate) / 100);
      break;
    case "monthly_principal":
    case "monthly_balance":
      for (let n = 1; ; n++) {
        const anniversary = dayjs(lentAt).add(n, "month").format("YYYY-MM-DD");
        if (anniversary > today) {
          break;
        }
        applyPaymentsBefore(anniversary);
        if (balance <= 0) {
          break;
        }
        const base = interest.type === "monthly_principal" ? principal : balance;
        charge(anniversary, (base * interest.rate) / 100);
      }
      break;
  }

  applyPaymentsBefore();

  const isSettled = balance <= 0;
  return {
    balance,
    interestTotal: round2(charges.reduce((sum, { amount }) => sum + amount, 0)),
    paidTotal: round2(paid),
    charges,
    overpayments,
    overpaid: round2(overpayments.reduce((sum, { amount }) => sum + amount, 0)),
    isSettled,
    settledAt: isSettled ? settledAt : null,
    isValid: payments.every(({ createdAt }) => day(createdAt) >= lentDay),
  };
}

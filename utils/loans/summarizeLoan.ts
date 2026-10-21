import dayjs from "dayjs";
import type { Loan } from "@/types";

export interface TLoanCharge { date: string; amount: number }
export interface TLoanSummary {
  balance: number;
  interestTotal: number;
  paidTotal: number;
  charges: TLoanCharge[];
  isSettled: boolean;
  settledAt: string | null;
  isValid: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const day = (d: string) => dayjs(d).format("YYYY-MM-DD");

export function summarizeLoan({ loan, payments, today }: {
  loan: Pick<Loan, "principal" | "lentAt" | "interest">;
  payments: { amount: number; createdAt: string }[];
  today: string;
}): TLoanSummary {
  const { principal, lentAt, interest } = loan;
  const lentDay = day(lentAt);
  const queue = payments
    .map(({ amount, createdAt }) => ({ day: day(createdAt), amount }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const charges: TLoanCharge[] = [];
  let balance = round2(principal);
  let paid = 0;
  let settledAt: string | null = null;

  const applyPaymentsBefore = (limit?: string) => {
    while (queue.length > 0 && (limit == null || queue[0].day < limit)) {
      const payment = queue.shift();
      if (payment == null) {
        return;
      }
      balance = round2(balance - payment.amount);
      paid += payment.amount;
      if (balance <= 0 && settledAt == null) {
        settledAt = payment.day;
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
    isSettled,
    settledAt: isSettled ? settledAt : null,
    isValid: balance >= 0 && payments.every(({ createdAt }) => day(createdAt) >= lentDay),
  };
}

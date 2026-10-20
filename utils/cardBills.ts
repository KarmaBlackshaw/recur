import dayjs from "dayjs";

export type CardTxn = { id: string; amount: number; createdAt: string };

export type BillSummary = {
  cutoff: Date;
  dueDate: Date;
  estimate: number;
  amount: number;
  isEstimate: boolean;
  paid: number;
  remaining: number;
  isPaid: boolean;
};

const EPSILON = 0.005;

const round2 = (n: number) => Math.round(n * 100) / 100;

const clampedDate = (day: number, year: number, month: number) => {
  const first = dayjs(new Date(year, month, 1));
  return first.date(Math.min(day, first.daysInMonth())).toDate();
};

export function billDates(statementDay: number, dueDay: number, year: number, month: number): { cutoff: Date; dueDate: Date } {
  const dueDate = clampedDate(dueDay, year, month);
  if (statementDay < dueDay) {
    return { cutoff: clampedDate(statementDay, year, month), dueDate };
  }
  const prev = dayjs(new Date(year, month, 1)).subtract(1, "month");
  return { cutoff: clampedDate(statementDay, prev.year(), prev.month()), dueDate };
}

export function computeBill(a: {
  txns: CardTxn[];
  statementDay: number;
  dueDay: number;
  year: number;
  month: number;
  override: number | null | undefined;
  now: Date;
}): BillSummary {
  const { cutoff, dueDate } = billDates(a.statementDay, a.dueDay, a.year, a.month);
  const cutoffEnd = dayjs(cutoff).endOf("day");

  let balance = 0;
  let paid = 0;
  for (const txn of a.txns) {
    const at = dayjs(txn.createdAt);
    if (!at.isAfter(cutoffEnd)) {
      balance += txn.amount;
    } else if (txn.amount < 0 && !at.isAfter(a.now)) {
      paid += -txn.amount;
    }
  }

  const estimate = Math.max(0, round2(balance));
  const amount = a.override ?? estimate;
  const roundedPaid = Math.min(round2(paid), amount);
  return {
    cutoff,
    dueDate,
    estimate,
    amount,
    isEstimate: a.override == null,
    paid: roundedPaid,
    remaining: Math.max(0, round2(amount - roundedPaid)),
    isPaid: roundedPaid >= amount - EPSILON,
  };
}

export const isBillTbd = ({ isEstimate, amount }: BillSummary) => isEstimate && amount === 0;

export function unsettledDebitIds(txns: CardTxn[]): Set<string> {
  const credits = txns.reduce((sum, { amount }) => (amount < 0 ? sum - amount : sum), 0);
  const debits = txns
    .filter(({ amount }) => amount > 0)
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id));
  const unsettled = new Set<string>();
  let running = 0;
  for (const debit of debits) {
    running += debit.amount;
    if (running > credits + EPSILON) {
      unsettled.add(debit.id);
    }
  }
  return unsettled;
}

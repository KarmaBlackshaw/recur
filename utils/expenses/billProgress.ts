import { sumBy } from "@/utils/collections";
import { round } from "@/utils/round";

export interface BillProgress {
  bill: number | null;
  paid: number;
  left: number | null;
}

export interface CyclePayment {
  amount: number;
  isCard: boolean;
  isCharged: boolean;
}

export interface CycleTotals {
  total: number;
  paid: number;
  charged: number;
}

const sum = (amounts: number[]) => round(amounts.reduce((total, amount) => total + amount, 0), 2);

export function billProgress({
  bill,
  payments,
  isPaid,
}: {
  bill: number | null;
  payments: number[];
  isPaid: boolean;
}): BillProgress {
  const paid = sum(payments);
  if (isPaid) {
    return { bill, paid, left: 0 };
  }
  return { bill, paid, left: bill == null ? null : Math.max(0, round(bill - paid, 2)) };
}

export function canPayPart({ left }: BillProgress, amount: number): boolean {
  return amount > 0 && (left == null || round(amount, 2) < left);
}

export function cycleTotals({
  isPaid,
  bill,
  payments,
  isCardWithoutRows,
}: {
  isPaid: boolean;
  bill: number | null;
  payments: CyclePayment[];
  isCardWithoutRows: boolean;
}): CycleTotals {
  if (payments.length === 0) {
    if (!isPaid) {
      return { total: bill ?? 0, paid: 0, charged: 0 };
    }
    return isCardWithoutRows
      ? { total: 0, paid: 0, charged: 0 }
      : { total: bill ?? 0, paid: bill ?? 0, charged: 0 };
  }
  const card = sumBy(payments.filter(({ isCard }) => isCard), "amount");
  const nonCard = sumBy(payments.filter(({ isCard }) => !isCard), "amount");
  const charged = sumBy(payments.filter(({ isCharged }) => isCharged), "amount");
  if (isPaid) {
    const settled = round((bill ?? card + nonCard) - card, 2);
    return { total: settled, paid: settled, charged: round(charged, 2) };
  }
  return {
    total: bill == null ? round(nonCard, 2) : round(bill - card, 2),
    paid: round(nonCard, 2),
    charged: round(charged, 2),
  };
}

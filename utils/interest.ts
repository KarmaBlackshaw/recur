import dayjs from "dayjs";
import type { InterestPeriod } from "@/types";

const FORMAT = "YYYY-MM-DD";
export const PERIODS_PER_YEAR: Record<InterestPeriod, number> = { daily: 365, monthly: 12, yearly: 1 };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function periodEnds(from: string, today: string, period: InterestPeriod): string[] {
  const ends: string[] = [];
  const unit = period === "daily" ? "day" : period === "monthly" ? "month" : "year";
  let end = dayjs(from).add(1, "day");
  if (unit !== "day") {
    end = dayjs(from).endOf(unit);
    if (!end.isAfter(dayjs(from), "day")) {
      end = dayjs(from).add(1, unit).endOf(unit);
    }
  }
  const limit = dayjs(today);
  while (end.isBefore(limit, "day")) {
    ends.push(end.format(FORMAT));
    end = unit === "day" ? end.add(1, "day") : end.add(1, unit).endOf(unit);
  }
  return ends;
}

export function accrueInterest(a: {
  rate: number;
  period: InterestPeriod;
  taxRate: number;
  from: string;
  today: string;
  balanceAt: (dateEnd: string) => number;
}): { gross: number; tax: number; through: string } | null {
  const ends = periodEnds(a.from, a.today, a.period);
  if (ends.length === 0) {
    return null;
  }
  let gross = 0;
  let net = 0;
  const start = dayjs(a.from);
  const isPartialFirst = a.period !== "daily" && !start.isSame(start.endOf(a.period === "monthly" ? "month" : "year"), "day");
  for (const [index, end] of ends.entries()) {
    const balance = a.balanceAt(end) + net;
    const base = (Math.max(balance, 0) * a.rate) / 100;
    const g =
      index === 0 && isPartialFirst
        ? (base * dayjs(end).diff(start, "day")) / 365
        : base / PERIODS_PER_YEAR[a.period];
    gross += g;
    net += g * (1 - a.taxRate / 100);
  }
  const roundedGross = round2(gross);
  return {
    gross: roundedGross,
    tax: round2(roundedGross - round2(net)),
    through: ends[ends.length - 1],
  };
}

export function netInterestPerPeriod(balance: number, rate: number, taxRate: number, period: InterestPeriod): number {
  return ((Math.max(balance, 0) * rate) / 100 / PERIODS_PER_YEAR[period]) * (1 - taxRate / 100);
}

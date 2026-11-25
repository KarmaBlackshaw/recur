import dayjs from "dayjs";
import type { BarBucket, MoneyFlow, Period, StatsView, TOption } from "@/types";

export const PERIODS: TOption<Period>[] = [
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

// Route params arrive as free text: anything but "year" / "income" falls back to the default.
export function parsePeriod(value: string | undefined): Period {
  return value === "year" ? "year" : "month";
}

export function parseMoneyFlow(value: string | undefined): MoneyFlow {
  return value === "income" ? "income" : "expenses";
}

// A year past four digits can't be shown (and past ±275,760 isn't even a Date), so it falls back like a bad month.
export function parseYear(value: string | undefined): number {
  const year = Number.parseInt(value ?? "", 10);
  return year >= 1000 && year <= 9999 ? year : dayjs().year();
}

export function parseMonth(value: string | undefined): number {
  const month = Number.parseInt(value ?? "", 10);
  return month >= 0 && month <= 11 ? month : dayjs().month();
}

export const BAR_BUCKETS: Record<Period, TOption<BarBucket>[]> = {
  month: [
    { label: "Days", value: "day" },
    { label: "Weeks", value: "week" },
  ],
  year: [
    { label: "Weeks", value: "week" },
    { label: "Months", value: "month" },
  ],
};

export function parseStatsView(value: string | undefined): StatsView {
  return value === "bar" ? "bar" : "donut";
}

export function resolveBarBucket(picked: BarBucket, period: Period): BarBucket {
  if (BAR_BUCKETS[period].some(({ value }) => value === picked)) {
    return picked;
  }
  return period === "month" ? "day" : "month";
}

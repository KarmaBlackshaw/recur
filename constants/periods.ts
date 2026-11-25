import dayjs from "dayjs";
import type { MoneyFlow, Period, StatsView, TOption } from "@/types";

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

// "bar" is the view's name before it became the Net so far line.
export function parseStatsView(value: string | undefined): StatsView {
  return value === "trend" || value === "bar" ? "trend" : "donut";
}

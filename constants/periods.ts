import type { MoneyFlow, Period, TOption } from "@/types";

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

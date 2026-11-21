import dayjs from "dayjs";
import { round } from "@/utils/round";

export interface ForecastLine {
  accountId: string | null;   // Null for the total of every debit and cash account.
  start: number;   // The balance now.
  values: number[];   // The balance at the end of each day, today first.
  threshold: number;
  lowest: number;
  lowestOn: Date;   // The first day it reaches its lowest.
  belowOn: Date | null;   // The first day it dips under the threshold.
}

// One balance projected day by day from today, as bills leave it.
export function projectLine({
  accountId,
  start,
  outflows,
  threshold,
  today,
  days,
}: {
  accountId: string | null;
  start: number;
  outflows: { amount: number; date: Date }[];
  threshold: number;
  today: Date;
  days: number;
}): ForecastLine {
  const first = dayjs(today).startOf("day");
  const outByDay = new Array<number>(days + 1).fill(0);
  for (const { amount, date } of outflows) {
    const day = Math.max(0, dayjs(date).startOf("day").diff(first, "day"));
    if (day <= days) {
      outByDay[day] += amount;
    }
  }

  const values: number[] = [];
  let balance = start;
  for (const out of outByDay) {
    balance = round(balance - out, 2);
    values.push(balance);
  }

  const lowest = Math.min(...values);
  const dayOf = (index: number) => first.add(index, "day").toDate();
  const belowIndex = values.findIndex((value) => value < threshold);
  return {
    accountId,
    start,
    values,
    threshold,
    lowest,
    lowestOn: dayOf(values.indexOf(lowest)),
    belowOn: belowIndex < 0 ? null : dayOf(belowIndex),
  };
}

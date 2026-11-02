import dayjs from "dayjs";

// Today keeps the real time; earlier days count at the end of that day, like a one-off's paid date.
export function paidAtFor(iso: string): string {
  const day = dayjs(iso);
  return day.isSame(dayjs(), "day") ? new Date().toISOString() : day.endOf("day").toISOString();
}

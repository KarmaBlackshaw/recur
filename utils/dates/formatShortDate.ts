import dayjs from "dayjs";

export function formatShortDate(date: string | Date): string {
  const day = dayjs(date);
  return day.format(day.isSame(dayjs(), "year") ? "MMM D" : "MMM D, YYYY");
}

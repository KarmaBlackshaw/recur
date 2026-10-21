import dayjs from "dayjs";

export function formatLoanAge(from: string, to: string): string {
  const start = dayjs(from).startOf("day");
  const end = dayjs(to).startOf("day");
  const days = end.diff(start, "day");

  if (days <= 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day";
  }

  const months = end.diff(start, "month");

  if (months === 0) {
    return `${days} days`;
  }

  if (months < 12) {
    return `${months} mo`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (remainingMonths === 0) {
    return `${years} yr`;
  }

  return `${years} yr ${remainingMonths} mo`;
}

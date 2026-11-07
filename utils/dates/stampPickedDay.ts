import dayjs from "dayjs";

// The moment a day picked in a form is stored at, so entries sort by when they happened: a day left as saved keeps
// its saved time, today is now, and an earlier day counts at its last moment.
export function stampPickedDay(picked: string, saved?: string | null): string {
  const day = dayjs(picked);
  if (saved != null && day.isSame(saved, "day")) {
    return saved;
  }
  return day.isSame(dayjs(), "day") ? new Date().toISOString() : day.endOf("day").toISOString();
}

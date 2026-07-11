export const monthKey = (id: string, year: number, month: number): string =>
  `${id}|${year}|${month}`;

// Inverse of monthKey. year/month are always the last two segments; the id
// (a Date.now() digit string) never contains "|", so rejoin the rest as the id.
export function parseMonthKey(key: string): { id: string; year: number; month: number } {
  const parts = key.split("|");
  const month = Number(parts.pop());
  const year = Number(parts.pop());
  return { id: parts.join("|"), year, month };
}

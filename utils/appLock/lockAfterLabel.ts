export function lockAfterLabel(minutes: number): string {
  if (minutes === 0) {
    return "Immediately";
  }
  return `After ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

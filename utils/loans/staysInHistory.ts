export function staysInHistory(subject: string, plural = false): string {
  return `${subject} ${plural ? "stay" : "stays"} in the account history, marked as reverted.`;
}

export function sanitizeAmount(text: string): string {
  const [int = "", ...rest] = text.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${int}.${rest.join("").slice(0, 2)}` : int;
}

export function formatAmountInput(raw: string): string {
  const [int, dec] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

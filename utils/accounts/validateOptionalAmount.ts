export function validateOptionalAmount(value: string) {
  if (value === "") {
    return true;
  }
  const n = parseFloat(value);
  return (!isNaN(n) && n >= 0) || "Must be ≥ 0";
}

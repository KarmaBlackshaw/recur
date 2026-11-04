export function parseOptionalAmount(value: string) {
  return value === "" ? 0 : parseFloat(value);
}

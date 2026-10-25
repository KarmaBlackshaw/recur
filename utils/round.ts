function numberToString(value: number): string {
  return Object.is(value, -0) ? "-0" : String(value);
}

// Moves the decimal point through the exponent instead of multiplying, so
// round(1.005, 2) is 1.01 rather than 1 (1.005 * 100 is 100.49999999999999).
function shift(value: number, places: number): number {
  const [mantissa, exponent = "0"] = numberToString(value).split("e");
  return Number(`${mantissa}e${Number(exponent) + places}`);
}

/** Rounds half up to `precision` decimal places (negative precision rounds left of the point). */
export function round(value: number, precision = 0): number {
  const places = Math.min(Math.trunc(precision), 292);
  if (!places || !Number.isFinite(value)) {
    return Math.round(value);
  }
  return shift(Math.round(shift(value, places)), -places);
}

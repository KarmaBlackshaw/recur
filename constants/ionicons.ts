// The Ionicons the app draws, with their codepoints in the full Ionicons font.
// assets/fonts/ionicons/Ionicons-Subset.ttf holds only these glyphs: after adding a
// name here, run `node scripts/subset-fonts.mjs` (it checks the codepoints too).
export const IONICON_GLYPHS = {
  "briefcase-outline": 0xf1b2,
  "business-outline": 0xf1c7,
  "card-outline": 0xf1e8,
  "cart-outline": 0xf203,
  "cash-outline": 0xf206,
  "checkmark-circle-outline": 0xf21f,
  "diamond-outline": 0xf2a2,
  "globe-outline": 0xf350,
  "home-outline": 0xf383,
  "phone-portrait-outline": 0xf4b5,
  "time-outline": 0xf5de,
  "wallet-outline": 0xf626,
} as const;

export type IoniconName = keyof typeof IONICON_GLYPHS;

export function isIoniconName(value: string | null): value is IoniconName {
  return value !== null && Object.prototype.hasOwnProperty.call(IONICON_GLYPHS, value);
}

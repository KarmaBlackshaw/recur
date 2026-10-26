// Regenerates the trimmed fonts the app ships: `node scripts/subset-fonts.mjs`.
//  - Oswald: drops Cyrillic and Greek, which the app never shows (any such text falls back
//    to the system font). Full originals live in assets/fonts/oswald/source.
//  - Ionicons: keeps only the glyphs listed in constants/ionicons.ts.
// Quicksand is shipped unmodified: its license reserves the name "Quicksand" for unmodified copies.
import fs from "node:fs";
import { createRequire } from "node:module";
import subsetFont from "subset-font";
import { IONICON_GLYPHS } from "../constants/ionicons.ts";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);

const OSWALD_WEIGHTS = ["Regular", "Medium", "SemiBold", "Bold"];
const OSWALD_RANGES = [
  [0x000d, 0x000d],
  [0x0020, 0x007e],
  [0x00a0, 0x036f], // Latin-1, Latin Extended A/B, IPA, spacing modifiers, combining marks
  [0x1e00, 0xffff], // Latin Extended Additional, punctuation, currency (₱), arrows, math, symbols
];

const textOf = (ranges) =>
  ranges.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i))).join("");

async function write(source, out, text, preserveNameIds) {
  const input = fs.readFileSync(source);
  const output = await subsetFont(input, text, { targetFormat: "truetype", preserveNameIds });
  fs.writeFileSync(new URL(out, root), output);
  console.log(`${out}: ${(input.length / 1024).toFixed(1)} KB -> ${(output.length / 1024).toFixed(1)} KB`);
}

const glyphMap = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");
for (const [name, codepoint] of Object.entries(IONICON_GLYPHS)) {
  if (glyphMap[name] !== codepoint) {
    throw new Error(`constants/ionicons.ts: "${name}" should be 0x${glyphMap[name]?.toString(16) ?? "?? (not an Ionicons name)"}`);
  }
}

for (const weight of OSWALD_WEIGHTS) {
  // nameIDs 13/14 carry the OFL notice the license requires on modified copies.
  await write(new URL(`assets/fonts/oswald/source/Oswald-${weight}.ttf`, root), `assets/fonts/oswald/Oswald-${weight}.ttf`, textOf(OSWALD_RANGES), [13, 14]);
}
await write(
  require.resolve("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"),
  "assets/fonts/ionicons/Ionicons-Subset.ttf",
  String.fromCodePoint(...Object.values(IONICON_GLYPHS)),
  []
);

// Renders the README hero and its download buttons from the HTML beside this file.
// Run from the repo root after `npm install` (fonts and sharp come from node_modules):
//   node .github/hero/render.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const PLAYWRIGHT = "playwright@1.64.1";
const SCALE = 2; // "Desktop Chrome HiDPI" renders at 2x, so PNGs stay sharp on retina screens.
const IMAGES = [
  { name: "hero", width: 1000, height: 460, radius: 28 },
  { name: "button-apk", width: 260, height: 64, radius: 14 },
  { name: "button-source", width: 260, height: 64, radius: 14 },
];

const here = dirname(fileURLToPath(import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "recur-hero-"));

function playwright(...args) {
  return execFileSync("npx", ["-y", PLAYWRIGHT, ...args], { stdio: "pipe" });
}

// The screenshot is square-cornered; cut the rounded corners out so the page behind shows through.
function cornerMask({ width, height, radius }) {
  const [w, h, r] = [width, height, radius].map((value) => value * SCALE);
  return Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
}

try {
  playwright("install", "chromium");
  for (const image of IMAGES) {
    const raw = join(scratch, `${image.name}.png`);
    const out = join(here, `${image.name}.png`);
    playwright(
      "screenshot",
      "--device=Desktop Chrome HiDPI",
      `--viewport-size=${image.width}, ${image.height}`,
      "--wait-for-selector=html.ready",
      pathToFileURL(join(here, `${image.name}.html`)).href,
      raw,
    );
    await sharp(raw)
      .composite([{ input: cornerMask(image), blend: "dest-in" }])
      .png({ palette: true, quality: 90, effort: 10 })
      .toFile(out);
    console.log(`${out} ${Math.round(statSync(out).size / 1024)} KB`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

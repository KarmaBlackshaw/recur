#!/usr/bin/env node
// Run: node scripts/generate-icons.mjs
// Requires: npm install --save-dev sharp

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const svg = readFileSync(resolve(root, 'assets/recur.svg'));

const icons = [
  { out: 'assets/icon.png',                     size: 1024, bg: null },
  { out: 'assets/android-icon-foreground.png',  size: 108,  bg: null },
  { out: 'assets/android-icon-monochrome.png',  size: 108,  bg: null },
  { out: 'assets/android-icon-background.png',  size: 108,  bg: '#161618' },
  { out: 'assets/favicon.png',                  size: 48,   bg: null },
];

for (const { out, size, bg } of icons) {
  const outPath = resolve(root, out);

  if (bg) {
    // Solid colour fill — no SVG content
    await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
      .png()
      .toFile(outPath);
  } else {
    await sharp(svg, { density: Math.ceil((size / 256) * 72) })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
  }

  console.log(`✓ ${out} (${size}×${size})`);
}

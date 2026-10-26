#!/usr/bin/env node
// Run: node scripts/generate-bank-logos.mjs
// Rasterizes the bank logos (assets/banks/*.svg, the source of truth) into square
// @1x/@2x/@3x PNGs. The app draws them at most 36dp wide (the template picker), and
// each logo is centered and contained the way an SVG viewBox would be.

import sharp from 'sharp';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const dir = resolve(__dir, '../assets/banks');
const SIZE_DP = 36;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  const svg = readFileSync(resolve(dir, file));
  const { width, height } = await sharp(svg).metadata();
  const name = file.replace(/\.svg$/, '');
  for (const scale of [1, 2, 3]) {
    const px = SIZE_DP * scale;
    // Render at twice the target size, then downsample, for smooth edges.
    const density = (72 * px * 2) / Math.max(width, height);
    const out = resolve(dir, `${name}${scale === 1 ? '' : `@${scale}x`}.png`);
    await sharp(svg, { density })
      .resize(px, px, { fit: 'contain', background: TRANSPARENT })
      .png({ compressionLevel: 9, palette: true, quality: 100 })
      .toFile(out);
  }
  console.log(`✓ ${name}`);
}

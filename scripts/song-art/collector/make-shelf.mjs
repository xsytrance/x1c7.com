#!/usr/bin/env node
// The AGENOR shelf: every collector spine side by side, like a game collection.
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const SPINE = 268, H = 2048;
const files = readdirSync(OUT).filter((f) => f.endsWith(".png") && !f.startsWith("shelf") && !f.startsWith("_")).sort();

const scale = 0.5;
const sw = Math.round(SPINE * scale), sh = Math.round(H * scale);
const perRow = Math.ceil(files.length / 2);
const GAP = 6, PAD = 40;
const W = PAD * 2 + perRow * (sw + GAP) - GAP;
const HH = PAD * 2 + 2 * sh + 24;

const comps = [];
for (let i = 0; i < files.length; i++) {
  const row = Math.floor(i / perRow), col = i % perRow;
  const buf = await sharp(join(OUT, files[i])).extract({ left: 0, top: 0, width: SPINE, height: H }).resize(sw, sh).toBuffer();
  comps.push({ input: buf, left: PAD + col * (sw + GAP), top: PAD + row * (sh + 24) });
}
await sharp({ create: { width: W, height: HH, channels: 3, background: "#0a0a0b" } })
  .composite(comps)
  .png()
  .toFile(join(OUT, "shelf.png"));
console.error(`shelf.png ${W}x${HH} with ${files.length} spines`);

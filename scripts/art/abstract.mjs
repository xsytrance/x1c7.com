#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ABSTRACT — turn a song's own plates into ATMOSPHERE.
//
// The plates are literal: a doorway, a face, a street. Used as a background
// they are a slideshow, and the owner has said so more than once. But their
// COLOUR and their light belong to the song, and that is the part worth
// keeping. So: destroy the subject, keep the light.
//
// Two products per song, both derived from its own art, so no two songs share
// a sky:
//
//   veil.webp    one wide, heavily abstracted frame — blurred past recognition,
//                posterised, contrast-crushed. Drifts behind everything as
//                cloud. You cannot tell what it was; you can tell it is this
//                song's palette in this song's light.
//   motes.webp   a 4x3 sheet of small soft patches cut from the BRIGHTEST
//                regions of the plates — particle sprites that carry the art's
//                own texture instead of a flat dot.
//
//   node scripts/art/abstract.mjs --slug <slug> [--out <dir>] [--plates a,b,c]
//
// Reads plate URLs from the track's planet.assets.keywords when --plates is
// omitted. Writes into scripts/song-analysis/profiles/<slug>/abstract/.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const SLUG = args.slug;
if (!SLUG) { console.error("usage: --slug <slug> [--plates url,url] [--out dir]"); process.exit(2); }

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const env = {};
for (const f of [".env", ".env.local"]) {
  const p = path.join(REPO, f); if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const R2 = (env.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, "");
const OUT = args.out ? String(args.out) : path.join(REPO, "scripts/song-analysis/profiles", SLUG, "abstract");
fs.mkdirSync(OUT, { recursive: true });

let urls;
if (args.plates && args.plates !== true) {
  urls = String(args.plates).split(",");
} else {
  const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from("tracks").select("planet").eq("id", SLUG);
  if (!data?.length) { console.error(`no track ${SLUG}`); process.exit(2); }
  urls = [...new Set(Object.values(data[0].planet?.assets?.keywords ?? {}))];
}
urls = urls.map((u) => (/^https?:/.test(u) ? u : R2 + u));
if (!urls.length) { console.error("no plates"); process.exit(2); }
console.log(`${urls.length} plates`);

async function grab(u) {
  const r = await fetch(u);
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}
const bufs = (await Promise.all(urls.map(grab))).filter(Boolean);
if (!bufs.length) { console.error("nothing fetched"); process.exit(1); }
console.log(`  fetched ${bufs.length}`);

// ── VEIL ── average several plates, then blur past recognition. Averaging
// first matters: one blurred plate still reads as that plate's composition,
// while four averaged lose the subject and keep only the light.
const W = 768, H = 1360;
// Averaging alone is not enough: these plates SHARE a composition (same artist
// block, same title text in the same place), so their features line up and
// survive the blur — the first attempt still read "TYLERHAZE" through 38px of
// it. Flip, rotate and offset each plate differently first so nothing aligns
// with anything, THEN average.
const prepared = await Promise.all(
  bufs.slice(0, 8).map((b, i) => {
    let img = sharp(b).resize(W, H, { fit: "cover" });
    if (i % 2) img = img.flop();
    if (i % 3 === 0) img = img.flip();
    return img
      .rotate((i * 37) % 23 - 11, { background: { r: 0, g: 0, b: 0 } })
      .resize(W, H, { fit: "cover" })
      .removeAlpha().raw().toBuffer();
  }),
);
const acc = new Float32Array(W * H * 3);
for (const p of prepared) for (let i = 0; i < acc.length; i++) acc[i] += p[i];
const avg = Buffer.alloc(W * H * 3);
for (let i = 0; i < acc.length; i++) avg[i] = Math.round(acc[i] / prepared.length);
await sharp(avg, { raw: { width: W, height: H, channels: 3 } })
  .blur(54)                      // past recognition, and then some
  .modulate({ saturation: 1.5 }) // the song's colour, louder
  .linear(1.25, -26)             // crush toward black so it can sit UNDER words
  .blur(9)
  .webp({ quality: 82 })
  .toFile(path.join(OUT, "veil.webp"));
console.log("  ✓ veil.webp");

// ── MOTES ── 12 soft patches cut from the BRIGHTEST part of each plate, where
// the light actually is. A dot wearing the art's own texture instead of a flat
// fill, so a song's weather is made of that song.
const TILE = 128, COLS = 4, ROWS = 3;
const tiles = [];
for (let i = 0; i < COLS * ROWS; i++) {
  const src = bufs[i % bufs.length];
  const meta = await sharp(src).metadata();
  const mw = meta.width ?? 832, mh = meta.height ?? 1472;
  // Pick by SMOOTHNESS, not brightness. Brightest-first handed back faces and
  // a mouth — the eye finds a face in a 128px dot instantly and it stops being
  // weather. Score each band as brightness MINUS edge energy, so the winner is
  // a bright but featureless region: sky, bokeh, a wash of light.
  const SW = 16, SH = 28;
  const small = await sharp(src).greyscale().resize(SW, SH, { fit: "fill" }).raw().toBuffer();
  let bestY = 0, best = -1e9;
  for (let y = 0; y < SH - 6; y++) {
    let lum = 0, edge = 0;
    for (let yy = y; yy < y + 6; yy++) {
      for (let x = 0; x < SW; x++) {
        const v = small[yy * SW + x];
        lum += v;
        if (x) edge += Math.abs(v - small[yy * SW + x - 1]);
        if (yy > y) edge += Math.abs(v - small[(yy - 1) * SW + x]);
      }
    }
    const score = lum / (SW * 6) - (edge / (SW * 6)) * 2.6;
    if (score > best) { best = score; bestY = y; }
  }
  const cy = Math.round((bestY + 3) / 28 * mh);
  const size = Math.round(Math.min(mw, mh) * 0.22);
  const left = Math.max(0, Math.min(mw - size, Math.round(mw / 2 + (((i * 37) % 11) - 5) / 10 * size)));
  const top = Math.max(0, Math.min(mh - size, cy - Math.round(size / 2)));
  tiles.push(await sharp(src).extract({ left, top, width: size, height: size })
    .resize(TILE, TILE).blur(11).modulate({ saturation: 1.6, brightness: 1.2 })
    .removeAlpha().toBuffer());
}
// soft round alpha so a mote has no square edge
const mask = Buffer.from(
  `<svg width="${TILE}" height="${TILE}"><defs><radialGradient id="g"><stop offset="0%" stop-color="#fff"/><stop offset="62%" stop-color="#fff" stop-opacity="0.75"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${TILE}" height="${TILE}" fill="url(#g)"/></svg>`,
);
const soft = await Promise.all(tiles.map(async (t) =>
  sharp(await sharp(t).ensureAlpha().toBuffer())
    .composite([{ input: await sharp(mask).toBuffer(), blend: "dest-in" }])
    .png().toBuffer()));
await sharp({ create: { width: TILE * COLS, height: TILE * ROWS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(soft.map((input, i) => ({ input, left: (i % COLS) * TILE, top: Math.floor(i / COLS) * TILE })))
  .webp({ quality: 88, alphaQuality: 90 })
  .toFile(path.join(OUT, "motes.webp"));
console.log(`  ✓ motes.webp  (${COLS}x${ROWS} @ ${TILE}px)`);
console.log(`\n→ ${OUT}`);

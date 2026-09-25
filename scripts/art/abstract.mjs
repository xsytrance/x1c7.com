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

// ── WHICH PLATES ────────────────────────────────────────────────────────────
// One veil for a whole song is one sky for a song that changes. With --acts
// the plates are grouped by the ACT their words fall in (dynamicPlus.acts), so
// each movement gets a sky made of its OWN pictures and the weather turns when
// the song does.
let urls;
let actGroups = null;
if (args.plates && args.plates !== true) {
  urls = String(args.plates).split(",");
} else {
  const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from("tracks").select("planet,lyrics_synced").eq("id", SLUG);
  if (!data?.length) { console.error(`no track ${SLUG}`); process.exit(2); }
  const kw = data[0].planet?.assets?.keywords ?? {};
  urls = [...new Set(Object.values(kw))];
  const acts = data[0].planet?.dynamicPlus?.acts ?? [];
  const words = data[0].lyrics_synced?.words ?? [];
  if (args.acts && acts.length) {
    actGroups = acts.map((a) => {
      const set = new Set();
      for (const w of words) {
        if (w.t < a.start || w.t > a.end) continue;
        const k = String(w.w).toLowerCase().replace(/[^a-z0-9']/g, "");
        if (kw[k]) set.add(kw[k]);
      }
      // an act with too few pictures of its own borrows from the whole song,
      // otherwise its sky is one blurred plate and the subject survives
      const list = [...set];
      while (list.length < 4 && urls.length) list.push(urls[(list.length * 5) % urls.length]);
      return { label: a.label ?? `act ${acts.indexOf(a) + 1}`, start: a.start, end: a.end, plates: list };
    });
  }
}
const abs = (u) => (/^https?:/.test(u) ? u : R2 + u);
urls = urls.map(abs);
if (actGroups) for (const g of actGroups) g.plates = g.plates.map(abs);
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
async function buildVeil(sourceBufs, outName) {
  const prep = await Promise.all(
    sourceBufs.slice(0, 8).map((b, i) => {
      let img = sharp(b).resize(W, H, { fit: "cover" });
      if (i % 2) img = img.flop();
      if (i % 3 === 0) img = img.flip();
      return img.rotate((i * 37) % 23 - 11, { background: { r: 0, g: 0, b: 0 } })
        .resize(W, H, { fit: "cover" }).removeAlpha().raw().toBuffer();
    }),
  );
  const a = new Float32Array(W * H * 3);
  for (const q of prep) for (let i = 0; i < a.length; i++) a[i] += q[i];
  const avg2 = Buffer.alloc(W * H * 3);
  for (let i = 0; i < a.length; i++) avg2[i] = Math.round(a[i] / prep.length);
  await sharp(avg2, { raw: { width: W, height: H, channels: 3 } })
    .blur(54).modulate({ saturation: 1.5 }).linear(1.25, -26).blur(9)
    .webp({ quality: 82 }).toFile(path.join(OUT, outName));
}
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

if (actGroups) {
  const manifest = [];
  for (const [i, g] of actGroups.entries()) {
    const gb = (await Promise.all(g.plates.map(grab))).filter(Boolean);
    if (gb.length < 2) { console.log(`  – ${g.label}: too few plates, skipped`); continue; }
    const name = `veil-${i}.webp`;
    await buildVeil(gb, name);
    manifest.push({ veil: name, start: g.start, end: g.end, label: g.label, plates: g.plates.length });
    console.log(`  ✓ ${name}  ${g.label}  (${gb.length} plates)`);
  }
  fs.writeFileSync(path.join(OUT, "veils.json"), JSON.stringify(manifest, null, 1));
}

// ── DEPTH LAYERS ───────────────────────────────────────────────────────────
// A veil over a flat photograph is still a flat photograph. To make a PLATE
// come alive it has to have depth — so cut each one into a NEAR layer (the
// subject) and a FAR layer (everything behind it), and let the stage move them
// at different rates. That is parallax, and it is what makes a still picture
// read as a place rather than a picture of one.
//
// No depth model is installed, and for this kind of plate none is needed: the
// subject is the SHARP thing. A heavy blur subtracted from the original leaves
// high-frequency detail, which is exactly where focus is; smoothing that gives
// a usable depth proxy, biased toward the centre because that is where a
// portrait's subject lives.
async function depthLayers(buf, base) {
  // A REAL silhouette when one exists (scripts/art/silhouette.py, rembg).
  // The proxy below is kept only as a fallback and is known not to work:
  // measured, it makes the frame softer than no layers at all, because a
  // near-global mask parallaxes a sharp image over itself and that ghosts.
  const maskPath = args.masks ? path.join(String(args.masks), `${base}.mask.png`) : null;
  if (maskPath && fs.existsSync(maskPath)) {
    const meta0 = await sharp(buf).metadata();
    // JOIN the mask as an alpha CHANNEL — do not composite it.
    //
    // `blend: "dest-in"` keeps the destination where the INPUT'S ALPHA is
    // opaque, and a greyscale mask png has no alpha: it is opaque everywhere,
    // so dest-in kept the entire plate. Every near layer ever produced here
    // was a full-frame opaque copy of the plate, offset by the parallax — a
    // ghost double image, which is exactly what a 3x drop in edge energy looks
    // like. It also explains why loosening the proxy mask changed nothing:
    // the mask was never being applied at all.
    // Interleave RGBA by hand. Two sharp APIs failed silently here and both
    // produced a fully opaque near layer, which is the worst possible failure
    // because it looks like a working file: `composite(dest-in)` reads the
    // MASK'S alpha (a greyscale png has none, so it keeps everything), and
    // joinChannel returned a 3-channel webp with hasAlpha=false. Verified by
    // reading the output back — channels=3, opaque 100%. Doing it by hand is
    // four lines and cannot lie.
    const W0 = meta0.width ?? 832, H0 = meta0.height ?? 1472;
    const rgb = await sharp(buf).removeAlpha().resize(W0, H0, { fit: "fill" }).raw().toBuffer();
    const mk = await sharp(maskPath).greyscale().resize(W0, H0, { fit: "fill" }).raw().toBuffer();
    const rgba = Buffer.alloc(W0 * H0 * 4);
    for (let i = 0, j = 0, k = 0; i < W0 * H0; i++, j += 3, k += 4) {
      rgba[k] = rgb[j]; rgba[k + 1] = rgb[j + 1]; rgba[k + 2] = rgb[j + 2]; rgba[k + 3] = mk[i];
    }
    await sharp(rgba, { raw: { width: W0, height: H0, channels: 4 } })
      .webp({ quality: 90, alphaQuality: 94 })
      .toFile(path.join(OUT, `${base}.near.webp`));
    // the FAR layer keeps the whole plate, barely softened — it is what shows
    // through the gap the subject leaves as it moves
    await sharp(buf).blur(3).modulate({ brightness: 0.94 })
      .webp({ quality: 86 }).toFile(path.join(OUT, `${base}.far.webp`));
    return "silhouette";
  }
  if (args.masksOnly) return null;
  return depthLayersProxy(buf, base);
}

async function depthLayersProxy(buf, base) {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 832, h = meta.height ?? 1472;
  const SW = Math.round(w / 6), SH = Math.round(h / 6);

  const grey = await sharp(buf).greyscale().resize(SW, SH, { fit: "fill" }).raw().toBuffer();
  const soft = await sharp(buf).greyscale().resize(SW, SH, { fit: "fill" }).blur(7).raw().toBuffer();
  const mask = Buffer.alloc(SW * SH);
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      const detail = Math.min(255, Math.abs(grey[i] - soft[i]) * 7);      // in focus = near
      const dx = (x / SW - 0.5) * 2, dy = (y / SH - 0.5) * 2 * 0.72;
      const centre = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 0.95); // portraits sit centre
      mask[i] = Math.max(0, Math.min(255, detail * 0.55 + centre * 190));
    }
  }
  // feather hard, or the cut-out shows its own edge
  // a raw-input pipeline has no format to infer: say png, or sharp refuses
  const alpha = await sharp(mask, { raw: { width: SW, height: SH, channels: 1 } })
    // Generous, not tight. At linear(1.6,-40) the cut-out kept so little that
    // the blurred FAR layer dominated the frame and the whole plate came out
    // SOFTER than before — measured edge energy 4.81 down to 1.37. The near
    // layer has to carry most of the picture; the far layer is only there to
    // fill what moves out from behind it.
    .blur(9).resize(w, h).linear(2.1, 10).blur(11).png().toBuffer();

  await sharp(buf)
    .removeAlpha()
    .joinChannel(await sharp(alpha).greyscale().raw().toBuffer(),
                 { raw: { width: w, height: h, channels: 1 } })
    .webp({ quality: 88, alphaQuality: 92 })
    .toFile(path.join(OUT, `${base}.near.webp`));
  // the far layer is the whole plate, softened, so the hole behind the subject
  // is filled with something plausible rather than a silhouette
  await sharp(buf).blur(4).modulate({ brightness: 0.9 })
    .webp({ quality: 84 }).toFile(path.join(OUT, `${base}.far.webp`));
  return "proxy";
}

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

if (args.depth) {
  const names = urls.map((u) => u.split("/").pop().replace(/\.[a-z]+$/i, ""));
  for (const [i, b] of bufs.entries()) {
    const how = await depthLayers(b, names[i]);
    if (how) console.log(`  ✓ ${names[i]}.near/.far  (${how})`);
    else console.log(`  – ${names[i]}: no silhouette, skipped`);
  }
}
console.log(`\n→ ${OUT}`);

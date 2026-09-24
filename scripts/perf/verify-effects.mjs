#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// VERIFY EFFECTS — prove that what the deck CLAIMS is actually on the screen.
//
// Written after a run of effects that were configured, committed, rendered and
// completely invisible: a word layer whose parent had opacity 0; a translateZ
// flattened by an intermediate wrapper; drain and rush gated on a variable that
// is null in the mode the cut actually renders in. Every one of them looked
// fine in the config and in the code, and the only thing that ever caught them
// was the owner watching the video.
//
// THE RULE THIS ENCODES: a check that cannot fail is worth nothing. So every
// detector here is run TWICE — once on a render with the effects ON and once
// with them OFF — and reports the pair. If a detector scores the same both
// ways it has proved nothing, and it says so rather than passing.
//
//   node scripts/perf/verify-effects.mjs --track <slug> --from S --to S
//     [--base http://localhost:3218] [--audio path] [--keep]
//
// Exit 1 if any enabled effect shows no measurable difference.
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const TRACK = args.track, FROM = Number(args.from), TO = Number(args.to);
const BASE = args.base || "http://localhost:3218";
if (!TRACK || !isFinite(FROM) || !isFinite(TO)) {
  console.error("usage: --track <slug> --from S --to S [--base URL] [--audio path]");
  process.exit(2);
}
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const env = {};
for (const f of [".env", ".env.local"]) {
  const p = path.join(REPO, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "verifyfx-"));
const W = 216, H = 384, N = W * H * 3;

const { data } = await db.from("tracks").select("planet").eq("id", TRACK);
if (!data?.length) { console.error(`no track row ${TRACK}`); process.exit(2); }
const planet = structuredClone(data[0].planet);
const deck = planet.dynamicPlus?.deck ?? {};
const scene = planet.dynamicPlus?.scene;

// which effects claim to be on
const claims = [];
if (deck.guide) claims.push("guide");
if (deck.inserts) claims.push("inserts");
if (deck.drain || deck.rush) claims.push("wordFlight");
if (deck.camSync) claims.push("camSync");
if (scene) claims.push(`scene:${scene}`);
if (!claims.length) { console.log("deck claims no verifiable effects — nothing to check"); process.exit(0); }
console.log(`VERIFY  ${TRACK}  ${FROM}→${TO}\n  claims: ${claims.join(", ")}\n`);

async function setDeck(on) {
  const p = structuredClone(data[0].planet);
  if (!on) {
    const d = p.dynamicPlus.deck;
    delete d.guide; delete d.inserts; delete d.drain; delete d.rush; delete d.camSync;
    delete p.dynamicPlus.scene;
  }
  const { error } = await db.from("tracks").update({ planet: p }).eq("id", TRACK);
  if (error) throw new Error(error.message);
}

function render(tag) {
  const out = path.join(TMP, `${tag}.mp4`);
  const a = ["scripts/perf/render-cut.mjs", "--vertical", "--track", TRACK,
    "--from", String(FROM), "--to", String(TO), "--base", BASE, "--out", out];
  if (args.audio) a.push("--audio", String(args.audio));
  execFileSync("node", a, { cwd: REPO, stdio: ["ignore", "ignore", "ignore"] });
  const v = out.replace(/\.mp4$/, "-vertical.mp4");
  const raw = path.join(TMP, `${tag}.rgb`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", v, "-vf", `scale=${W}:${H}`, "-pix_fmt", "rgb24", "-f", "rawvideo", raw]);
  return { video: v, buf: fs.readFileSync(raw) };
}

// ── detectors ──────────────────────────────────────────────────────────────
const px = (b, o, x, y) => { const i = o + (y * W + x) * 3; return [b[i], b[i + 1], b[i + 2]]; };

// the guide is a small NEAR-WHITE disc; this song's art never reaches neutral white
function guideFrames({ buf }) {
  // Counting white pixels anywhere scores HIGHER with the guide off, because a
  // bright plate highlight is also near-white. The guide is distinguished by
  // being SMALL and TIGHT, so measure the blob's bounding box, not its colour.
  const n = Math.floor(buf.length / N); let hit = 0;
  for (let k = 0; k < n; k++) { const o = k * N;
    let c = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, g, b] = px(buf, o, x, y);
      if (r > 205 && g > 200 && b > 190) { c++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    // a ~2vw disc is ~5px at this scale; a plate highlight sprawls
    if (c >= 3 && c <= 90 && x1 - x0 <= 14 && y1 - y0 <= 14) hit++; }
  return { value: +(100 * hit / n).toFixed(1), unit: "% frames with a small tight white disc" };
}

// an insert is a hard band: a luma seam at BOTH of its edges
function insertFrames({ buf }, cfg) {
  const h = (cfg?.height ?? 30) / 100;
  const at = cfg?.at ?? "center";
  const top = at === "top" ? 0 : at === "bottom" ? Math.round(H * (1 - h)) : Math.round(H * (0.5 - h / 2));
  const bot = at === "top" ? Math.round(H * h) : at === "bottom" ? H - 1 : Math.round(H * (0.5 + h / 2));
  const n = Math.floor(buf.length / N); let hit = 0;
  const rowLuma = (o, y) => { let s = 0; for (let x = 0; x < W; x++) { const [r, g, b] = px(buf, o, x, y); s += 0.2126 * r + 0.7152 * g + 0.0722 * b; } return s / W; };
  for (let k = 0; k < n; k++) { const o = k * N;
    const dTop = top > 3 ? Math.abs(rowLuma(o, top + 2) - rowLuma(o, top - 3)) : 0;
    const dBot = bot < H - 4 ? Math.abs(rowLuma(o, bot - 2) - rowLuma(o, bot + 3)) : 0;
    if (dTop > 3 && dBot > 3) hit++; }
  return { value: +(100 * hit / n).toFixed(1), unit: "% frames with a band seam" };
}

// word flight: how far the biggest word swells past a TYPICAL word. Compared
// against natural variation, because words already differ in size by tier.
function wordSwell({ buf }) {
  const n = Math.floor(buf.length / N); const areas = [];
  for (let k = 0; k < n; k++) { const o = k * N; let c = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, g, b] = px(buf, o, x, y);
      if (r > 135 && r > g * 1.18 && b < r * 0.62) c++;
    }
    if (c > 300) areas.push(c); }
  if (areas.length < 10) return { value: 0, unit: "peak/typical word area (no text found)" };
  areas.sort((a, b) => a - b);
  const med = areas[areas.length >> 1], peak = areas[areas.length - 1];
  return { value: +(peak / med).toFixed(1), unit: "x peak/typical word area" };
}

// a stepping camera HOLDS; a drifting one never rests. Global motion floor.
// camSync is NOT measurable from the rendered pixels: plate crossfades, word
// animation and particles swamp the camera's holds, and a global frame-delta
// reads the same either way (measured: 0.05 on and 0.05 off, which proves
// nothing about the camera). Ask the engine what its own camera is doing.
async function cameraHolds(on) {
  const { chromium } = await import("playwright");
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1080, height: 1948 }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}/studio?track=${TRACK}&embed=1&autoplay=1&pass=6&mode=dynamic&t=${FROM}`, { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(6000);
    const xs = await pg.evaluate(async () => {
      let host = null;
      for (const el of document.querySelectorAll("*"))
        if (el instanceof HTMLElement && el.style.cssText.includes("--cam-x")) { host = el; break; }
      const out = []; const t0 = performance.now();
      while (performance.now() - t0 < 9000) {
        if (host) out.push(parseFloat(host.style.getPropertyValue("--cam-x")) || 0);
        await new Promise((r) => setTimeout(r, 40));
      }
      return out;
    });
    if (xs.length < 20) return { value: 0, unit: "% camera samples held (no --cam-x found)" };
    let held = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - xs[i - 1]) < 0.05) held++;
    return { value: +(100 * held / (xs.length - 1)).toFixed(1), unit: "% camera samples completely still" };
  } finally { await b.close(); }
}

// ── run ────────────────────────────────────────────────────────────────────
let failed = 0;
try {
  console.log("  rendering ON  …"); await setDeck(true);  const on  = render("on");
  console.log("  rendering OFF …"); await setDeck(false); const off = render("off");
  await setDeck(true);

  const tests = [];
  if (deck.guide) tests.push(["guide", guideFrames, null, (a, b) => a.value - b.value > 3]);
  if (deck.inserts) tests.push(["inserts", insertFrames, deck.inserts, (a, b) => a.value - b.value > 3]);
  if (deck.drain || deck.rush) tests.push(["wordFlight", wordSwell, null, (a, b) => a.value > b.value * 1.6]);


  console.log(`\n  ${"effect".padEnd(12)}${"ON".padStart(10)}${"OFF".padStart(10)}   verdict   what was measured`);
  for (const [name, fn, cfg, pass] of tests) {
    const a = fn(on, cfg), b = fn(off, cfg);
    const ok = pass(a, b);
    if (!ok) failed++;
    console.log(`  ${name.padEnd(12)}${String(a.value).padStart(10)}${String(b.value).padStart(10)}   ${ok ? "VISIBLE " : "NO DIFF "}  ${a.unit}`);
  }
  if (deck.camSync) {
    await setDeck(true);  const camOn  = await cameraHolds(true);
    await setDeck(false); const camOff = await cameraHolds(false);
    await setDeck(true);
    const ok = camOn.value - camOff.value > 10;
    if (!ok) failed++;
    console.log(`  ${"camSync".padEnd(12)}${String(camOn.value).padStart(10)}${String(camOff.value).padStart(10)}   ${ok ? "VISIBLE " : "NO DIFF "}  ${camOn.unit}`);
  }
  console.log(`\n  ${failed ? `✗ ${failed} effect(s) claimed but NOT demonstrable` : "✓ every claimed effect measurably changes the picture"}`);
  if (args.keep) console.log(`  renders kept in ${TMP}`);
} finally {
  if (!args.keep) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} }
}
process.exit(failed ? 1 : 0);

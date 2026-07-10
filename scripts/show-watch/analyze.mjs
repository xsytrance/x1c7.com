// ── SHOW-WATCH ANALYZER ─────────────────────────────────────────────────────
// Pixel detectors + frame stats + contact sheets over a watch run. Standalone
// so detector thresholds can be re-tuned without re-capturing:
//
//   node scripts/show-watch/analyze.mjs <runDir> [--only=slug,slug]
//
// Writes per show: report.json (anomalies + frame stats), sheet.jpg (32-tile
// contact sheet with timestamps — the reviewable "watch this show in one
// image"), flags.jpg (close-ups of flagged frames, when any).

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(join(process.cwd(), "package.json"));
const sharp = require("sharp");

const runDir = process.argv[2];
if (!runDir || !existsSync(runDir)) { console.error("usage: analyze.mjs <runDir> [--only=...]"); process.exit(1); }
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const log = (...a) => console.error(...a);

// Thresholds (calibrated against this stage's real render: black bg, backdrop
// at 0.6 opacity, glowing type):
const BLACK_MEAN = 6, BLACK_STD = 5;   // truly empty frame
const WHITE_MEAN = 200;               // nothing legitimately whites out the viewport
const FLICKER_DELTA = 60;             // 2× the loudest legit move (1.6s crossfade ≈ <40/2s)
const FROZEN_HAMMING = 2, FROZEN_DIFF = 1.5, FROZEN_RUN = 4; // 8s pixel-identical
const CAPTURE_EXCLUDE_MS = 300;       // rAF gaps this close to a screenshot are harness jank

// dHash: 9x8 greyscale, bit = left>right neighbor.
async function frameFeatures(path) {
  const img = sharp(path).greyscale();
  const [stats, tiny, small] = await Promise.all([
    img.clone().stats(),
    img.clone().resize(9, 8, { fit: "fill" }).raw().toBuffer(),
    img.clone().resize(64, 64, { fit: "fill" }).raw().toBuffer(),
  ]);
  let hash = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    hash = (hash << 1n) | (tiny[y * 9 + x] > tiny[y * 9 + x + 1] ? 1n : 0n);
  }
  return { mean: stats.channels[0].mean, std: stats.channels[0].stdev, hash, small };
}
const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const meanAbsDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

// Section-presence lookup: songT → vocal presence %, for grading dark frames.
function presenceLookup(slug) {
  try {
    const p = JSON.parse(readFileSync(join(process.cwd(), "scripts/song-analysis/profiles", slug, "profile.json"), "utf8"));
    const secs = p.analysis?.sections ?? [];
    const pres = new Map((p.show?.vocalPresence ?? []).map((v) => [v.name, v.presence]));
    return (t) => {
      let cur = null;
      for (const s of secs) if (t >= s.start) cur = s; else break;
      return cur ? (pres.get(cur.name) ?? 50) : 50;
    };
  } catch { return () => 50; }
}

function frameStats(raw) {
  const { gaps = [], syncs = [], captures = [] } = raw;
  if (!gaps.length || !syncs.length) return null;
  // Wall time per gap: interpolate between the per-60-frame wall stamps.
  const walls = new Array(gaps.length);
  for (let s = 0; s < syncs.length; s++) {
    const a = syncs[s], b = syncs[s + 1];
    const endI = b ? b.i : gaps.length - 1;
    const endW = b ? b.wall : a.wall + gaps.slice(a.i, endI + 1).reduce((x, y) => x + y, 0);
    for (let i = a.i; i <= endI; i++) walls[i] = a.wall + ((i - a.i) / Math.max(1, endI - a.i)) * (endW - a.wall);
  }
  const kept = [];
  for (let i = 0; i < gaps.length; i++) {
    if (walls[i] == null) continue;
    if (captures.some((c) => Math.abs(walls[i] - c) < CAPTURE_EXCLUDE_MS)) continue;
    if (gaps[i] > 0 && gaps[i] < 2000) kept.push(gaps[i]);
  }
  if (!kept.length) return null;
  kept.sort((a, b) => a - b);
  const q = (p) => kept[Math.min(kept.length - 1, Math.floor(kept.length * p))];
  return {
    n: kept.length,
    fps: +(1000 / q(0.5)).toFixed(1),
    p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1),
    max: +kept[kept.length - 1].toFixed(1),
    jank50: kept.filter((x) => x > 50).length,
    jank100: kept.filter((x) => x > 100).length,
    minutes: +(kept.reduce((a, b) => a + b, 0) / 60000).toFixed(1),
  };
}

function svgLabel(w, h, text, flagged) {
  return Buffer.from(
    `<svg width="${w}" height="${h}">` +
    (flagged ? `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#ff2440" stroke-width="8"/>` : "") +
    `<rect y="${h - 22}" width="${w}" height="22" fill="black" opacity="0.72"/>` +
    `<text x="7" y="${h - 6}" font-size="14" fill="#fff" font-family="monospace">${text}</text></svg>`,
  );
}

async function contactSheet(frames, flaggedTs, out, cols = 8, rows = 4, tw = 190, th = 412) {
  const want = cols * rows;
  let picks;
  if (frames.length <= want) picks = frames;
  else {
    const stride = frames.length / want;
    picks = Array.from({ length: want }, (_, i) => frames[Math.floor(i * stride)]);
    // Force-swap flagged frames into their nearest tile.
    for (const ft of flaggedTs) {
      const f = frames.find((x) => x.t === ft);
      if (!f || picks.includes(f)) continue;
      let bi = 0, bd = Infinity;
      picks.forEach((p, i) => { const d = Math.abs(p.t - ft); if (d < bd) { bd = d; bi = i; } });
      picks[bi] = f;
    }
    picks.sort((a, b) => a.t - b.t);
  }
  const tiles = await Promise.all(picks.map(async (f) => ({
    input: await sharp(f.path).resize(tw, th, { fit: "cover" })
      .composite([{ input: svgLabel(tw, th, `${f.t.toFixed(1)}s`, flaggedTs.has(f.t)), top: 0, left: 0 }])
      .jpeg().toBuffer(),
  })));
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ ...t, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
    .jpeg({ quality: 80 }).toFile(out);
}

async function flagsSheet(frames, flaggedTs, out) {
  const picks = frames.filter((f) => flaggedTs.has(f.t)).slice(0, 8);
  if (!picks.length) return false;
  const tw = 380, th = 824, cols = Math.min(4, picks.length);
  const rows = Math.ceil(picks.length / cols);
  const tiles = await Promise.all(picks.map(async (f) => ({
    input: await sharp(f.path).resize(tw, th, { fit: "cover" })
      .composite([{ input: svgLabel(tw, th, `${f.t.toFixed(1)}s`, true), top: 0, left: 0 }])
      .jpeg().toBuffer(),
  })));
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: "#000" } })
    .composite(tiles.map((t, i) => ({ ...t, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
    .jpeg({ quality: 82 }).toFile(out);
  return true;
}

async function analyzeShow(dir) {
  const slug = basename(dir);
  const raw = JSON.parse(readFileSync(join(dir, "raw.json"), "utf8"));
  const framesDir = join(dir, "frames");
  const frames = existsSync(framesDir)
    ? readdirSync(framesDir).filter((f) => f.endsWith(".jpg"))
        .map((f) => ({ path: join(framesDir, f), t: parseFloat(f.slice(1)) }))
        .filter((f) => Number.isFinite(f.t)).sort((a, b) => a.t - b.t)
    : [];
  const anomalies = [];
  const presence = presenceLookup(slug);

  // In-page recorder findings.
  if (raw.fatal) anomalies.push({ type: "fatal", severity: 1, songT: -1, detail: raw.fatal });
  for (const e of raw.nodeEvents ?? []) {
    if (e.type.startsWith("info.")) continue; // optional planet extras 404 by design
    anomalies.push({ type: e.type, severity: e.type === "pageerror" ? 1 : 2, songT: e.songT, detail: e.msg });
  }
  for (const e of raw.errors ?? []) anomalies.push({ type: "window.error", severity: 1, songT: e.songT, detail: e.msg });
  for (const c of raw.ctxLost ?? []) anomalies.push({ type: "context-lost", severity: 1, songT: c.songT, detail: c.kind });
  for (const s of raw.stalls ?? []) anomalies.push({ type: "audio-stall", severity: 2, songT: s.songT, detail: `readyState=${s.readyState}` });
  for (const b of raw.imgBad ?? []) anomalies.push({ type: `backdrop-${b.kind}`, severity: 2, songT: b.songT, detail: b.src });
  for (const o of raw.overflow ?? []) anomalies.push({ type: "word-overflow", severity: 2, songT: o.songT, detail: `"${o.word}" ${o.px}px past ${o.edge}` });
  for (const n of raw.nanStyles ?? []) anomalies.push({ type: "nan-style", severity: 2, songT: n.songT, detail: `${n.tag}.${n.cls}` });
  if (raw.status && raw.status !== "ok") anomalies.push({ type: "run-status", severity: 1, songT: -1, detail: raw.status });

  // Pixel detectors.
  const feats = [];
  for (const f of frames) {
    try { feats.push({ ...f, ...(await frameFeatures(f.path)) }); } catch { /* unreadable frame */ }
  }
  const flaggedTs = new Set();
  const flag = (type, severity, f, detail) => { anomalies.push({ type, severity, songT: f.t, detail, frame: f.path }); flaggedTs.add(f.t); };

  let blackRun = [];
  for (let i = 0; i < feats.length; i++) {
    const f = feats[i], prev = feats[i - 1], next2 = feats[i + 1];
    if (f.mean < BLACK_MEAN && f.std < BLACK_STD) blackRun.push(f);
    else {
      if (blackRun.length >= 2) {
        const mid = blackRun[Math.floor(blackRun.length / 2)];
        const vocal = presence(mid.t) >= 30;
        flag("black-frame", vocal ? 1 : 3, mid, `${blackRun.length} consecutive dark samples (${blackRun[0].t.toFixed(0)}–${blackRun[blackRun.length - 1].t.toFixed(0)}s, vocals ${vocal ? "active" : "quiet"})`);
      }
      blackRun = [];
    }
    if (f.mean > WHITE_MEAN) flag("white-flash", 2, f, `mean luminance ${f.mean.toFixed(0)}`);
    if (prev && next2) {
      const d1 = f.mean - prev.mean, d2 = next2.mean - f.mean;
      if (Math.abs(d1) > FLICKER_DELTA && Math.abs(d2) > FLICKER_DELTA && Math.sign(d1) !== Math.sign(d2)) {
        flag("flicker", 2, f, `luminance ${prev.mean.toFixed(0)}→${f.mean.toFixed(0)}→${next2.mean.toFixed(0)}`);
      }
    }
  }
  // Frozen stage: FROZEN_RUN consecutive near-identical frames while songT advances.
  let run = [feats[0]].filter(Boolean);
  for (let i = 1; i < feats.length; i++) {
    const a = run[run.length - 1], b = feats[i];
    if (hamming(a.hash, b.hash) <= FROZEN_HAMMING && meanAbsDiff(a.small, b.small) < FROZEN_DIFF) run.push(b);
    else {
      if (run.length >= FROZEN_RUN && run[run.length - 1].t - run[0].t > 6) {
        flag("frozen-stage", 1, run[Math.floor(run.length / 2)], `${run.length} identical frames over ${(run[run.length - 1].t - run[0].t).toFixed(0)}s (${run[0].t.toFixed(0)}–${run[run.length - 1].t.toFixed(0)}s)`);
      }
      run = [b];
    }
  }
  if (run.length >= FROZEN_RUN && run[run.length - 1].t - run[0].t > 6) {
    flag("frozen-stage", 1, run[Math.floor(run.length / 2)], `${run.length} identical frames over ${(run[run.length - 1].t - run[0].t).toFixed(0)}s at end`);
  }

  const stats = frameStats(raw);
  const advisory = raw.mode !== "full";
  if (stats && !advisory && raw.profile === "mobile") {
    const perMin = stats.jank50 / Math.max(0.5, stats.minutes);
    if (stats.p95 > 50) anomalies.push({ type: "perf-p95", severity: 3, songT: -1, detail: `p95 ${stats.p95}ms (budget 50)` });
    if (perMin > 8) anomalies.push({ type: "perf-jank", severity: 3, songT: -1, detail: `${perMin.toFixed(1)} jank50/min (budget 8)` });
  }

  if (feats.length) {
    await contactSheet(feats, flaggedTs, join(dir, "sheet.jpg"));
    await flagsSheet(feats, flaggedTs, join(dir, "flags.jpg"));
  }

  anomalies.sort((a, b) => a.severity - b.severity || a.songT - b.songT);
  const report = {
    slug, title: raw.title, mode: raw.mode, profile: raw.profile, browser: raw.browser,
    lite: raw.lite, status: raw.status, frames: frames.length,
    stats: stats ? { ...stats, advisory } : null,
    anomalies,
    sheet: feats.length ? join(dir, "sheet.jpg") : null,
    flags: flaggedTs.size ? join(dir, "flags.jpg") : null,
  };
  writeFileSync(join(dir, "report.json"), JSON.stringify(report, null, 1));
  return report;
}

const dirs = readdirSync(runDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(runDir, d.name, "raw.json")))
  .map((d) => join(runDir, d.name))
  .filter((d) => !only || only.includes(basename(d)));

let s1 = 0, s2 = 0, s3 = 0;
for (const d of dirs) {
  const r = await analyzeShow(d);
  const c = { 1: 0, 2: 0, 3: 0 };
  for (const a of r.anomalies) c[a.severity]++;
  s1 += c[1]; s2 += c[2]; s3 += c[3];
  log(`  ${c[1] ? "✗" : c[2] ? "!" : "✓"} ${r.slug}  S1:${c[1]} S2:${c[2]} S3:${c[3]}${r.stats ? `  p95:${r.stats.p95}ms${r.stats.advisory ? "*" : ""}` : ""}`);
}
log(`analyzed ${dirs.length} shows — S1:${s1} S2:${s2} S3:${s3}`);
log(`next: node scripts/show-watch/report.mjs ${runDir}`);

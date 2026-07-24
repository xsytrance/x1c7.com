#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RENDER CUT — record a directed slice of the Kinetic stage to an mp4.
//
// Drives /studio?embed=1 in a REAL headful Chromium on the real GPU, waits for
// the ?t= start-seek to land, then captures via CDP screencast while the show
// plays.
//
// TIMING (v2 — the pixel clock): every frame carries its OWN ground-truth
// timestamp, painted into the pixels. A strip of binary squares at the top of
// the viewport encodes audio.currentTime in ms, updated in the same rAF the
// engine renders from — so a captured JPEG says exactly which audio moment
// its stage content belongs to. Frames are stamped by DECODING that strip
// (not by trusting CDP screencast timestamps, which carry capture-lag), the
// strip is cropped out of the output, and the audio slice is trimmed
// sample-accurately with atrim (an mp3 input -ss is only frame-accurate).
// The old CDP-clock mapping is still computed and reported as a diagnostic:
// `pixel-vs-CDP` tells you how wrong the old timing was.
//
//   node scripts/perf/render-cut.mjs \
//     [--track summer-drip] [--from 176.4] [--to 236.9] \
//     [--mode dynamic] [--pass 6] [--out out.mp4] [--audio release.mp3]
//     [--base http://localhost:7272] [--w 1920] [--h 1080] [--shots 0]
//     [--vertical] [--both]
//
// --shots N grabs N evenly-spaced QA stills instead of recording (fast loop).
// --vertical = the 9:16 phone cut (1080×1920, "-vertical" filename suffix) —
//   a real portrait re-record, NOT a crop: the stage lays out for the tall
//   frame. --both records 16:9 then 9:16 back-to-back (every directed cut
//   ships as the pair — owner's standing rule 2026-07-23).
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "node_modules", "sharp"));

// ── the pixel clock ── a strip of binary cells encoding audio ms, painted
// above the stage and cropped out of the final frame. 21 bits ≈ 35 min max.
const PROBE_BITS = 21, PROBE_CELL = 26, PROBE_H = 28;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));

const TRACK = args.track ?? "summer-drip";
const FROM = Number(args.from ?? 176.4);
const TO = Number(args.to ?? 236.9);
const MODE = args.mode ?? "dynamic";
const PASS = args.pass ?? "6";
const BASE = args.base ?? "http://localhost:7272";
const VERT = !!args.vertical;
const W = Number(args.w ?? (VERT ? 1080 : 1920)), H = Number(args.h ?? (VERT ? 1920 : 1080));
const SHOTS = Number(args.shots ?? 0);
const AUDIO = args.audio && args.audio !== true ? resolve(args.audio)
  : join(REPO, "scripts/song-analysis/profiles", TRACK, "release.mp3");
const baseOut = args.out && args.out !== true ? resolve(args.out) : resolve(`${TRACK}-cut.mp4`);
const OUT = VERT ? baseOut.replace(/\.mp4$/, "-vertical.mp4") : baseOut;
const WORK = join(dirname(OUT), `.render-${TRACK}${VERT ? "-v" : ""}`);
const log = (...a) => console.error(...a);

// --both: the pair, back to back — this process runs the 16:9 pass, then a
// child runs the same invocation with --vertical.
if (args.both) {
  const { execFileSync: run } = await import("node:child_process");
  const passArgs = process.argv.slice(2).filter((a) => a !== "--both");
  for (const extra of [[], ["--vertical"]]) {
    run(process.execPath, [fileURLToPath(import.meta.url), ...passArgs, ...extra], { stdio: "inherit" });
  }
  process.exit(0);
}

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: [
    `--window-size=${W},${H + PROBE_H + 90}`,
    "--autoplay-policy=no-user-gesture-required",
    "--hide-scrollbars",
    "--disable-infobars",
    "--no-first-run",
  ],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H + PROBE_H }, deviceScaleFactor: 1 });
await ctx.grantPermissions(["microphone"], { origin: BASE }); // keeps the MicPrimer banner away
const page = await ctx.newPage();
// The player builds its element with `new Audio()` — detached, invisible to
// querySelector. Wrap the constructor before any page script runs so every
// instance is reachable; the "main" one is whichever is actually rolling.
await page.addInitScript(() => {
  try { localStorage.setItem("x1c7-boot-seen", "1"); } catch {} // skip the boot ceremony
  window.__audios = [];
  const A = window.Audio;
  const W = function (...a) { const el = new A(...a); window.__audios.push(el); return el; };
  W.prototype = A.prototype;
  window.Audio = W;
});

const url = `${BASE}/studio?track=${TRACK}&embed=1&autoplay=1&pass=${PASS}&mode=${MODE}&t=${FROM}`;
log(`→ ${url}`);
await page.goto(url, { waitUntil: "domcontentloaded" });

const pickAudio = `(() => {
  const list = (window.__audios || []).filter((a) => a.src);
  return list.find((a) => !a.paused) ?? list.sort((x, y) => (y.duration || 0) - (x.duration || 0))[0] ?? null;
})()`;
const audioTime = () => page.evaluate(`(() => {
  const a = ${pickAudio};
  return a ? { t: a.currentTime, paused: a.paused, dur: a.duration || 0 } : null;
})()`);

// Wait for playback to start and the ?t= seek to land inside the window.
log("… waiting for playback + start-seek");
const t0 = Date.now();
for (;;) {
  const a = await audioTime();
  if (a && !a.paused && a.t >= FROM - 0.5 && a.t < FROM + 8) break;
  if (Date.now() - t0 > 90_000) { log("✗ playback/seek never landed", JSON.stringify(await audioTime())); await browser.close(); process.exit(1); }
  await new Promise((r) => setTimeout(r, 150));
}
log(`  rolling at ${(await audioTime()).t.toFixed(2)}s`);

// Render-rig chrome hide: the global player bar and the beat-game pill are
// site furniture, not the show — the video frame carries the stage only.
await page.addStyleTag({ content: `
  div.fixed.bottom-0.left-0.right-0.z-50 { display: none !important; } /* MusicPlayerBar */
  button.fixed.left-4.top-24 { display: none !important; }             /* beat pill */
  .fixed.bottom-4.left-4 { display: none !important; }                 /* UI sound pill */
  nextjs-portal { display: none !important; }                          /* Next dev indicator */
` });

// Mount the pixel clock: one rAF loop paints audio ms into the strip. It runs
// in the exact same frame cadence the engine's own rAF renders in, so the
// strip and the stage content in any captured frame agree by construction.
await page.evaluate(`(() => {
  const audio = ${pickAudio};
  const el = document.createElement("div");
  el.id = "__pixelclock";
  el.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;display:flex;pointer-events:none;background:#000;height:${PROBE_H}px;width:100%";
  const cells = [];
  for (let i = 0; i < ${PROBE_BITS}; i++) {
    const c = document.createElement("div");
    c.style.cssText = "width:${PROBE_CELL}px;height:${PROBE_H}px;background:#000";
    el.appendChild(c); cells.push(c);
  }
  document.body.appendChild(el);
  (function tick() {
    const ms = Math.round(audio.currentTime * 1000);
    for (let i = 0; i < ${PROBE_BITS}; i++) cells[i].style.background = (ms >> i) & 1 ? "#fff" : "#000";
    requestAnimationFrame(tick);
  })();
})()`);

if (SHOTS > 0) {
  // ── QA stills mode ──
  const marks = Array.from({ length: SHOTS }, (_, i) => FROM + ((TO - FROM) * (i + 0.5)) / SHOTS);
  for (const m of marks) {
    for (;;) {
      const a = await audioTime();
      if (!a || a.t >= m) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const f = join(WORK, `shot-${m.toFixed(1)}.png`);
    await page.screenshot({ path: f });
    log(`  📸 ${f} @${m.toFixed(1)}s`);
  }
  await browser.close();
  process.exit(0);
}

// ── Record: CDP screencast, frames stamped against the audio clock ──────────
const cdp = await ctx.newCDPSession(page);
const frames = []; // { file, wall } — wall = CDP metadata.timestamp (epoch s)
let fi = 0;
cdp.on("Page.screencastFrame", async (ev) => {
  const file = join(WORK, `f${String(fi++).padStart(5, "0")}.jpg`);
  writeFileSync(file, Buffer.from(ev.data, "base64"));
  frames.push({ file, wall: ev.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
});

// clock anchors: (wall performance-epoch, audio t) at start and end
const anchor = () => page.evaluate(`(() => {
  const a = ${pickAudio};
  return { t: a.currentTime, epoch: Date.now() / 1000 };
})()`);

// roll a touch early so the first in-window frame exists
for (;;) { const a = await audioTime(); if (a.t >= FROM - 0.25) break; await new Promise((r) => setTimeout(r, 50)); }
const a0 = await anchor();
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: W, maxHeight: H + PROBE_H, everyNthFrame: 1 });
log("● recording …");
for (;;) {
  const a = await audioTime();
  if (!a || a.t >= TO) break;
  await new Promise((r) => setTimeout(r, 200));
}
await cdp.send("Page.stopScreencast");
const a1 = await anchor();
await new Promise((r) => setTimeout(r, 400));
await browser.close();
log(`  ${frames.length} frames over ${(a1.t - a0.t).toFixed(2)}s of song (${(frames.length / (a1.t - a0.t)).toFixed(1)} fps)`);

// ── STAMP: decode every frame's pixel clock — the ground truth ──────────────
log(`… decoding the pixel clock on ${frames.length} frames`);
let wrongSize = 0;
const decodeClock = async (file, checkSize = false) => {
  if (checkSize) {
    // a window resize mid-capture (WM/user activity) makes the screencast
    // re-negotiate its surface — those frames are a different layout entirely
    // and must not enter the timeline. If many are lost, the whole take is
    // suspect: re-run with the capture window left alone.
    const m = await sharp(file).metadata();
    if (m.width !== W || m.height !== H + PROBE_H) { wrongSize++; return null; }
  }
  const buf = await sharp(file)
    .extract({ left: 0, top: 0, width: PROBE_BITS * PROBE_CELL, height: PROBE_H })
    .greyscale().raw().toBuffer();
  const rowW = PROBE_BITS * PROBE_CELL;
  let ms = 0, ok = true;
  for (let i = 0; i < PROBE_BITS; i++) {
    const x = i * PROBE_CELL + (PROBE_CELL >> 1);
    // sample a 3-point column mid-cell; jpeg ringing can't flip all three
    const ys = [8, PROBE_H >> 1, PROBE_H - 8];
    const v = ys.reduce((s, y) => s + buf[y * rowW + x], 0) / ys.length;
    if (v > 90 && v < 165) ok = false; // ambiguous — partial paint
    if (v >= 165) ms |= 1 << i;
  }
  return ok ? ms / 1000 : null;
};
const stampedAll = [];
for (const f of frames) {
  try {
    const at = await decodeClock(f.file, true);
    if (at != null) stampedAll.push({ ...f, at });
  } catch { /* unreadable frame — drop */ }
}
if (wrongSize > 0) log(`  ⚠ ${wrongSize} frames dropped for wrong surface size (window was disturbed mid-capture)`);
if (wrongSize > frames.length * 0.1) {
  log("✗ too much of the take lost to surface resizes — leave the capture window alone and re-run");
  process.exit(1);
}
// keep the in-window, strictly-increasing sequence (dupes = same rAF served
// twice by the compositor; a backwards jump = a corrupt decode)
const stamped = [];
for (const f of stampedAll.sort((x, y) => x.at - y.at)) {
  if (f.at < FROM - 0.05 || f.at > TO + 0.05) continue;
  if (stamped.length && f.at <= stamped[stamped.length - 1].at + 0.0005) continue;
  stamped.push(f);
}
if (stamped.length < 50) { log("✗ too few decodable frames"); process.exit(1); }
// Trim the seek-settle head: after ?t= lands, currentTime can freeze for a
// few hundred ms while the pipeline refills — a frozen opening frame that
// would play against moving audio. Start the cut on flowing content.
while (stamped.length > 2 && stamped[1].at - stamped[0].at > 0.08) stamped.shift();

// Diagnostic: how wrong was the OLD clock (CDP timestamp + anchor offset)?
const offset = a0.t - a0.epoch;
const errs = stamped.map((f) => (f.wall + offset) - f.at).sort((a, b) => a - b);
const q = (p) => errs[Math.floor(p * (errs.length - 1))];
log(`  pixel-vs-CDP clock error: median ${(q(0.5) * 1000).toFixed(0)}ms, p10 ${(q(0.1) * 1000).toFixed(0)}ms, p90 ${(q(0.9) * 1000).toFixed(0)}ms (this was the old sync error)`);
log(`  ${stamped.length} clean frames, decode-dropped ${frames.length - stampedAll.length}, dupes ${stampedAll.length - stamped.length - (stampedAll.length - frames.length < 0 ? 0 : 0)}`);

// concat demuxer with true per-frame durations from the pixel clock
const first = stamped[0].at, last = stamped[stamped.length - 1].at;
let lines = "";
for (let i = 0; i < stamped.length; i++) {
  const dur = i < stamped.length - 1 ? stamped[i + 1].at - stamped[i].at : 1 / 30;
  lines += `file '${stamped[i].file}'\nduration ${Math.max(dur, 0.001).toFixed(4)}\n`;
}
lines += `file '${stamped[stamped.length - 1].file}'\n`;
const list = join(WORK, "frames.txt");
writeFileSync(list, lines);

const D = last - first;
log(`assembling ${stamped.length} frames spanning ${D.toFixed(2)}s (audio ${first.toFixed(3)}→${last.toFixed(3)})`);
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-f", "concat", "-safe", "0", "-i", list,
  "-i", AUDIO,
  "-filter_complex",
  // crop the pixel-clock strip out; atrim decodes and cuts on the exact sample
  `[0:v]crop=${W}:${H}:0:${PROBE_H},fps=60,scale=${W}:${H}:flags=lanczos,format=yuv420p[v];` +
  `[1:a]atrim=start=${first.toFixed(3)}:end=${(first + D).toFixed(3)},asetpts=PTS-STARTPTS,` +
  `afade=t=in:st=0:d=0.35,afade=t=out:st=${(D - 0.4).toFixed(2)}:d=0.4[a]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart",
  OUT,
]);
log(`✦ ${OUT}`);

// ── CLOSED-LOOP VERIFY ── rebuild ONLY the pixel-clock strip through the
// same concat+fps timeline, decode it back out of the encoded video, and
// measure the finished file's residual A/V error. This is the instrument
// that catches what eyeballs feel: if the numbers here aren't single-digit
// milliseconds (median), something upstream regressed.
const proof = join(WORK, "proof.mp4");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
  "-vf", `crop=${PROBE_BITS * PROBE_CELL}:${PROBE_H}:0:0,fps=60`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "10", proof]);
const proofDir = join(WORK, "proof-frames");
mkdirSync(proofDir, { recursive: true });
// select every 30th frame VERBATIM (passthrough, no fps resample — fps=2
// here would re-round frames to slot centers and fake a +250ms error)
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", proof,
  "-vf", "select='not(mod(n\\,30))'", "-fps_mode", "passthrough", join(proofDir, "p%05d.png")]);
const pfiles = readdirSync(proofDir).filter((f) => f.endsWith(".png")).sort();
const residuals = [];
for (let k = 0; k < pfiles.length; k++) {
  const at = await decodeClock(join(proofDir, pfiles[k]));
  if (at == null) continue;
  residuals.push(Math.abs(at - (first + k / 2)) * 1000);
}
residuals.sort((a, b) => a - b);
const rq = (p) => residuals[Math.floor(p * (residuals.length - 1))] ?? NaN;
log(`  VERIFY (${residuals.length} probes): |A/V error| median ${rq(0.5).toFixed(1)}ms · p95 ${rq(0.95).toFixed(1)}ms${rq(0.95) > 40 ? "  ⚠ ABOVE TOLERANCE" : "  ✓"}`);

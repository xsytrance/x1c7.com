// ── SHOW-WATCH DRIVER ───────────────────────────────────────────────────────
// Plays every show in a real browser and records what the eyes see.
//
//   node scripts/show-watch/watch.mjs [--mode=scrub|full] [--profile=mobile|desktop]
//        [--browser=chromium|webkit] [--base=http://localhost:3199]
//        [--only=slug,slug] [--parallel=N] [--video] [--shots=2] [--out=dir]
//
// Requires a PRODUCTION server: npm run build && npx next start -p 3199
// (dev-mode React overhead poisons every frame number).
//
//   scrub — seek to smart sample points (sections, act edges, 8s grid),
//           dwell 2.5s each: the correctness pass. ~2 min/show, parallel 5.
//   full  — real-time playback of the whole song: the perf pass. parallel 2
//           (beyond 2, renderer main threads contend and the jank you measure
//           is the harness, not the show).
//
// Output: artifacts/show-watch/<runId>/<slug>/{raw.json, frames/*.jpg}
// then: node scripts/show-watch/analyze.mjs <runDir> && node scripts/show-watch/report.mjs <runDir>

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initScript, attachNodeCollectors } from "./instrument.mjs";
import { loadTracks, samplePoints } from "./tracks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? "1"];
}));
const MODE = args.mode || "scrub";
const PROFILE = args.profile || "mobile";
const BROWSER = args.browser || "chromium";
const BASE = args.base || "http://localhost:3199";
const ONLY = args.only ? new Set(args.only.split(",")) : null;
const PARALLEL = Number(args.parallel || (MODE === "full" ? 2 : 5));
const VIDEO = args.video === "1";
const SHOT_EVERY = Number(args.shots || 2) * 1000;
const DWELL = 2500, SETTLE = 600;
const log = (...a) => console.error(...a);

if (VIDEO && !ONLY) { log("--video needs --only (targeted repro, not sweeps)"); process.exit(1); }

const { chromium, webkit } = await import(join(ROOT, "node_modules", "playwright", "index.mjs"));
const engine = BROWSER === "webkit" ? webkit : chromium;

const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
const runId = args.out || `${stamp}_${MODE}-${PROFILE}-${BROWSER}`;
const runDir = join(ROOT, "artifacts", "show-watch", runId);
mkdirSync(runDir, { recursive: true });

const tracks = loadTracks({ only: ONLY });
if (!tracks.length) { log("no tracks matched"); process.exit(1); }
log(`show-watch  ${MODE} · ${PROFILE} · ${BROWSER} · ${tracks.length} show(s) · parallel ${PARALLEL}`);
log(`  → ${runDir}`);

const browser = await engine.launch({
  args: BROWSER === "chromium" ? ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] : [],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openShow(page, track) {
  await page.goto(`${BASE}/music`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // The collection prettifies some DB titles (e.g. "A / B" renders as "A: B"),
  // so try each candidate prefix before giving up.
  const candidates = [...new Set([track.title, track.title.replace(/ \/ /g, ": ")])];
  let spine = null;
  for (const t of candidates) {
    const loc = page.locator(`[aria-label^="${t.replace(/"/g, '\\"')} —"]`).first();
    if (await loc.waitFor({ timeout: spine === null && candidates.length > 1 ? 8000 : 20000 }).then(() => true).catch(() => false)) { spine = loc; break; }
  }
  if (!spine) throw new Error(`no card matched title candidates: ${candidates.join(" | ")}`);
  const stage = page.locator(".kinetic-stage").first();
  // Click until the takeover mounts: one click plays under a touch UA, two on
  // desktop (arm → play). Never force a click once the overlay is up.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await stage.isVisible().catch(() => false)) break;
    await spine.click({ timeout: 4000 }).catch(() => {});
    await sleep(900);
  }
  await stage.waitFor({ timeout: 15000 });
  // Some songs open with a "mic moments" prompt — skip it so it neither blocks
  // input nor pollutes the frames.
  for (let i = 0; i < 5; i++) {
    const skip = page.getByText(/^skip$/i).first();
    if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); break; }
    await sleep(500);
  }
}

async function runShow(track) {
  const dir = join(runDir, track.slug);
  const framesDir = join(dir, "frames");
  mkdirSync(framesDir, { recursive: true });
  const nodeEvents = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, // shelf layout for the open flow
    // DPR 3 only where fidelity matters (full-mode perf): raster memory scales
    // with DPR² and five DPR-3 contexts once OOM'd the server on this box.
    deviceScaleFactor: PROFILE === "mobile" ? (MODE === "full" ? 3 : 2) : 1,
    userAgent: PROFILE === "mobile"
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
    ...(VIDEO ? { recordVideo: { dir, size: { width: 390, height: 844 } } } : {}),
  });
  const page = await context.newPage();
  await page.addInitScript(initScript, { perf: PROFILE === "mobile" ? "lite" : "full" });
  attachNodeCollectors(page, nodeEvents);

  let status = "ok";
  try {
    await openShow(page, track);
    // The show is a fixed overlay — resize to the phone frame after opening.
    if (PROFILE === "mobile") {
      await page.setViewportSize({ width: 390, height: 844 });
      if (BROWSER === "chromium" && MODE === "full") {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      }
      await sleep(800); // relayout settle
    }

    const seek = (t) => page.evaluate((tt) => {
      const a = window.__watch?.audio();
      if (a) a.currentTime = tt;
    }, t);
    const songT = () => page.evaluate(() => window.__watch?.songT() ?? -1);
    const shoot = async (label) => {
      // A mic primer that re-surfaces would sit over every frame — dismiss it
      // like a listener would so the pixel detectors see the stage.
      const skip = page.getByText(/^skip$/i).first();
      if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 1000 }).catch(() => {});
      await page.evaluate(() => window.__watch?.markCapture()).catch(() => {});
      const t = await songT().catch(() => -1);
      const name = `t${String(Math.max(0, t)).padStart(6, "0")}.jpg`;
      await page.screenshot({ path: join(framesDir, name), type: "jpeg", quality: 60, scale: "css" })
        .catch(() => {});
      return t;
    };

    if (MODE === "scrub") {
      for (const t of samplePoints(track)) {
        await seek(t);
        await sleep(SETTLE + DWELL / 2);
        await shoot();
        await sleep(DWELL / 2);
      }
    } else {
      const wallCap = Date.now() + (track.duration + 45) * 1000;
      let t = 0;
      while (Date.now() < wallCap) {
        t = await shoot();
        if (t >= track.duration - 1.5) break;
        await sleep(SHOT_EVERY);
      }
      if (t < track.duration - 10) status = `ended-early@${t}`;
    }

    const dump = await page.evaluate(() => window.__watch?.dump() ?? null);
    writeFileSync(join(dir, "raw.json"), JSON.stringify({
      slug: track.slug, title: track.title, duration: track.duration,
      mode: MODE, profile: PROFILE, browser: BROWSER, status,
      nodeEvents, ...dump,
    }));
  } catch (e) {
    status = "crashed";
    writeFileSync(join(dir, "raw.json"), JSON.stringify({
      slug: track.slug, title: track.title, duration: track.duration,
      mode: MODE, profile: PROFILE, browser: BROWSER,
      status, fatal: String(e.message).slice(0, 400), nodeEvents,
    }));
  }
  await context.close().catch(() => {});
  return status;
}

// Simple promise pool.
let next = 0;
const results = new Array(tracks.length);
await Promise.all(Array.from({ length: Math.min(PARALLEL, tracks.length) }, async () => {
  while (next < tracks.length) {
    const i = next++;
    const t = tracks[i];
    const t0 = Date.now();
    results[i] = await runShow(t);
    log(`  ${results[i] === "ok" ? "✓" : "✗"} ${t.slug}  (${results[i]}, ${Math.round((Date.now() - t0) / 1000)}s)  [${i + 1}/${tracks.length}]`);
  }
}));

await browser.close();
writeFileSync(join(runDir, "run.json"), JSON.stringify({
  runId, mode: MODE, profile: PROFILE, browser: BROWSER, parallel: PARALLEL,
  base: BASE, shows: tracks.map((t, i) => ({ slug: t.slug, status: results[i] })),
  finishedAt: new Date().toISOString(),
}, null, 1));
const bad = results.filter((r) => r !== "ok").length;
log(`done — ${tracks.length - bad}/${tracks.length} ok${bad ? ` · ${bad} FAILED` : ""}`);
log(`next: node scripts/show-watch/analyze.mjs ${runDir}`);

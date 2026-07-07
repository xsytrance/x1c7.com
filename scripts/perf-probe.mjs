// ── PERF PROBE ──────────────────────────────────────────────────────────────
// Measures the full show under mobile CPU throttling and prints real frame-time
// stats — so renderer changes are judged by numbers, not by eye.
//
//   node scripts/perf-probe.mjs [--base=http://localhost:3000] [--dur=12]
//                               [--cpu=4] [--scenes=normal,fog] [--lite=1]
//
// Requires a running server (npm run build && npx next start) and Playwright
// (npm i -D playwright && npx playwright install chromium).

import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "1"];
  }),
);
const BASE = args.base || "http://localhost:3000";
const DUR = Number(args.dur || 12);
const CPU = Number(args.cpu || 4); // 4× slowdown ≈ a mid-tier phone
const SCENES = (args.scenes || "normal,fog").split(",");
const LITE = args.lite ?? "1";
const MODE = args.mode || "dynamic";
const WEATHER = args.weather || "rain";
const STEMS = args.stems ?? "";   // "1" attaches a stems.json (per-frame stem writes)
const PLANET = args.planet ?? ""; // <slug> measures a REAL planet instead of synthetic
const AT = args.at ?? "";         // song-time (s) to park a real planet's clock at

// Installed BEFORE any app code: force the perf profile + record every frame.
function initScript(lite) {
  try {
    if (lite === "1") localStorage.setItem("x1c7-perf", "lite");
    else if (lite === "0") localStorage.setItem("x1c7-perf", "full");
    sessionStorage.setItem("x1c7-boot-seen", "1"); // skip the bootloader animation
  } catch {}
  // @ts-ignore
  window.__perf = { frames: [], longtasks: [] };
  let last = performance.now();
  const rec = (now) => {
    // @ts-ignore
    window.__perf.frames.push(now - last);
    last = now;
    requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
  try {
    new PerformanceObserver((l) => {
      // @ts-ignore
      for (const e of l.getEntries()) window.__perf.longtasks.push(e.duration);
    }).observe({ entryTypes: ["longtask"] });
  } catch {}
}

function stats(frames) {
  const f = frames.filter((x) => x > 0 && x < 2000).sort((a, b) => a - b);
  if (!f.length) return null;
  const q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))];
  const sum = f.reduce((a, b) => a + b, 0);
  return {
    n: f.length,
    fps: +(1000 / q(0.5)).toFixed(1),
    meanMs: +(sum / f.length).toFixed(1),
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    p99: +q(0.99).toFixed(1),
    max: +f[f.length - 1].toFixed(1),
    jank50: f.filter((x) => x > 50).length, // dropped-frame events (>50ms)
    jank100: f.filter((x) => x > 100).length,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(browser, scene, lite) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.addInitScript(initScript, lite);
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  await client.send("Performance.enable").catch(() => {});
  const metricMap = async () => {
    const { metrics } = await client.send("Performance.getMetrics");
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
  };

  const extra = `${STEMS ? `&stems=${STEMS}` : ""}${PLANET ? `&planet=${encodeURIComponent(PLANET)}` : ""}${AT ? `&at=${AT}` : ""}`;
  const url = `${BASE}/dev/perf?scene=${scene}&lite=${lite}&mode=${MODE}&weather=${WEATHER}${extra}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  const stageOk = await page.waitForSelector(".kinetic-stage", { timeout: 15000 }).then(() => true).catch(() => false);
  await sleep(3200); // settle: veil roll-in (2.6s), first words, weather ramp
  // Sanity: a broken page (chunk error / stuck boot) would read as "fast" — refuse it.
  const alive = await page.evaluate(() => ({
    stage: !!document.querySelector(".kinetic-stage"),
    canvases: document.querySelectorAll("canvas").length,
    frames: (window.__perf && window.__perf.frames.length) || 0,
  }));
  if (!stageOk || !alive.stage || alive.frames < 30) {
    await context.close();
    throw new Error(`[${scene}] show not rendering (stage=${alive.stage} canvases=${alive.canvases} frames=${alive.frames}) — check the server/build`);
  }
  await page.evaluate(() => {
    // @ts-ignore
    window.__perf.frames.length = 0;
    // @ts-ignore
    window.__perf.longtasks.length = 0;
  });
  // Main-thread busy time is the real signal — headless clamps rAF to vsync, so
  // sub-16ms per-frame cost hides in FPS but shows here as CPU seconds burned.
  const m0 = await metricMap();
  const t0 = Date.now();
  await sleep(DUR * 1000);
  const m1 = await metricMap();
  const wall = (Date.now() - t0) / 1000;
  const data = await page.evaluate(() => window.__perf);
  await context.close();
  const s = stats(data.frames);
  const lt = data.longtasks || [];
  const d = (k) => (m1[k] ?? 0) - (m0[k] ?? 0);
  // Per wall-second, and divided by CPU throttle so numbers read as "desktop ms"
  // — the RATIO between scenes/builds is what matters.
  const perSec = (k) => +((d(k) / wall) * 1000).toFixed(0); // ms of work per real second
  return {
    scene,
    lite,
    ...s,
    cpuMsPerS: perSec("TaskDuration"),
    scriptMsPerS: perSec("ScriptDuration"),
    layoutMsPerS: perSec("LayoutDuration"),
    styleMsPerS: perSec("RecalcStyleDuration"),
    longtasks: lt.length,
    longtaskMs: +lt.reduce((a, b) => a + b, 0).toFixed(0),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const rows = [];
  for (const scene of SCENES) {
    rows.push(await measure(browser, scene.trim(), LITE));
  }
  await browser.close();

  console.log(`\n  base=${BASE}  cpu=${CPU}x  dur=${DUR}s  lite=${LITE}  mode=${MODE}  weather=${WEATHER}\n`);
  const cols = ["scene", "fps", "p95", "p99", "max", "jank50", "cpuMsPerS", "scriptMsPerS", "layoutMsPerS", "styleMsPerS"];
  console.log("  " + cols.map((c) => c.padStart(10)).join(""));
  for (const r of rows) {
    console.log("  " + cols.map((c) => String(r[c] ?? "-").padStart(10)).join(""));
  }
  console.log("\n  (fps = 1000/p50; jank50 = frames >50ms; lower ms/jank = smoother)\n");
  console.log(JSON.stringify(rows));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

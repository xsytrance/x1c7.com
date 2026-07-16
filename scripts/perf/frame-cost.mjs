// Frame-cost harness for the Kinetica stage. Measures main-thread cost
// (scripting / style-recalc / layout / paint) via a Chrome trace, plus rAF
// frame deltas and long-task jank, on an isolated embed stage.
//
// NOTE on the GL backend: this box renders WebGL via swiftshader (CPU), so
// absolute GPU/raster time is inflated and NOT the user's real GPU cost. The
// MAIN-THREAD categories (Scripting, RecalcStyle, Layout) are GPU-backend
// independent and DO represent the user's CPU cost. GPU attribution comes from
// the A/B matrix (backdrop on pass=6 vs off pass=2), not absolute raster time.

import { chromium } from "playwright";

const TRACK = process.env.TRACK || "days-drift-by";
const SECONDS = Number(process.env.SECS || 10);
const BASE = "http://localhost:7272";

const CONFIGS = [
  { label: "dynamic+backdrop (pass6)", mode: "dynamic", pass: 6 },
  { label: "dynamic, no-backdrop (pass2)", mode: "dynamic", pass: 2 },
  { label: "phrase+backdrop (pass6)", mode: "phrase", pass: 6 },
];

// group timeline event names into main-thread buckets
const BUCKET = (name) =>
  /FunctionCall|EvaluateScript|v8|RunMicrotasks|MinorGC|MajorGC|Timer|RequestAnimationFrame|FireAnimationFrame|ProfileCall/.test(name) ? "scripting"
  : /RecalcStyle|UpdateLayoutTree|ScheduleStyleRecalc|InvalidateLayout/.test(name) ? "style"
  : /^Layout$|Layout\b/.test(name) ? "layout"
  : /Paint|UpdateLayer|Rasterize|DecodeImage|ImageDecode/.test(name) ? "paint"
  : /Composite|Commit/.test(name) ? "composite"
  : /GPUTask/.test(name) ? "gpu"
  : null;

const pct = (v, sorted) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * v))];

async function measure(page, cfg) {
  const url = `${BASE}/studio?track=${TRACK}&mode=${cfg.mode}&pass=${cfg.pass}&embed=1&autoplay=1`;
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(5500); // autoplay + warmup

  // instrument: frame deltas + long tasks
  await page.evaluate(() => {
    window.__frames = [];
    window.__long = 0; window.__longMs = 0;
    let last = 0;
    const loop = (t) => { if (last) window.__frames.push(t - last); last = t; window.__raf = requestAnimationFrame(loop); };
    window.__raf = requestAnimationFrame(loop);
    try {
      window.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__long++; window.__longMs += e.duration; } });
      window.__po.observe({ entryTypes: ["longtask"] });
    } catch { /* no longtask support */ }
  });

  const client = await page.context().newCDPSession(page);
  const events = [];
  client.on("Tracing.dataCollected", (d) => { for (const e of d.value) events.push(e); });
  await client.send("Tracing.start", {
    categories: "disabled-by-default-devtools.timeline,devtools.timeline,v8.execute",
    transferMode: "ReportEvents",
  });
  const t0 = Date.now();
  await page.waitForTimeout(SECONDS * 1000);
  await client.send("Tracing.end");
  await new Promise((r) => setTimeout(r, 800)); // drain dataCollected
  const windowMs = Date.now() - t0;

  const { frames, long, longMs } = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf); window.__po?.disconnect();
    return { frames: window.__frames, long: window.__long, longMs: window.__longMs };
  });

  // frame stats
  const fs = frames.filter((d) => d < 250).sort((a, b) => a - b);
  const med = pct(0.5, fs), p95 = pct(0.95, fs), p99 = pct(0.99, fs);
  const fps = fs.length ? 1000 / (fs.reduce((a, b) => a + b, 0) / fs.length) : 0;

  // main-thread category totals (sum complete-event durations, main thread only)
  const buckets = { scripting: 0, style: 0, layout: 0, paint: 0, composite: 0, gpu: 0 };
  for (const e of events) {
    if (e.ph !== "X" || typeof e.dur !== "number") continue;
    const b = BUCKET(e.name);
    if (b) buckets[b] += e.dur / 1000; // us → ms
  }
  const mainBusy = buckets.scripting + buckets.style + buckets.layout + buckets.paint + buckets.composite;

  return {
    label: cfg.label,
    fps: fps.toFixed(1),
    medFrame: med?.toFixed(1), p95: p95?.toFixed(1), p99: p99?.toFixed(1),
    longTasks: long, longMsPerSec: (longMs / (windowMs / 1000)).toFixed(0),
    // per-second main-thread ms in each bucket (out of 1000ms/s budget)
    scripting: (buckets.scripting / (windowMs / 1000)).toFixed(0),
    style: (buckets.style / (windowMs / 1000)).toFixed(0),
    layout: (buckets.layout / (windowMs / 1000)).toFixed(0),
    paint: (buckets.paint / (windowMs / 1000)).toFixed(0),
    mainBusyPerSec: (mainBusy / (windowMs / 1000)).toFixed(0),
  };
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

console.log(`\nKinetica frame-cost harness · track=${TRACK} · ${SECONDS}s/config · swiftshader (main-thread ms is representative, raster is not)\n`);
const rows = [];
for (const cfg of CONFIGS) rows.push(await measure(page, cfg));

const cols = ["label", "fps", "medFrame", "p95", "p99", "longTasks", "scripting", "style", "layout", "paint", "mainBusyPerSec"];
const head = ["config", "fps", "med", "p95", "p99", "jank#", "script", "style", "layout", "paint", "busy/s"];
const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[cols[i]]).length)));
const fmt = (arr) => arr.map((v, i) => String(v).padEnd(w[i])).join("  ");
console.log(fmt(head));
console.log(w.map((n) => "-".repeat(n)).join("  "));
for (const r of rows) console.log(fmt(cols.map((c) => r[c])));
console.log("\n(ms values are main-thread ms spent PER SECOND — out of a 1000ms/s budget; >~700 = main-thread bound)\n");

await browser.close();

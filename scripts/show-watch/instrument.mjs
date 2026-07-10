// ── SHOW-WATCH INSTRUMENT ───────────────────────────────────────────────────
// The in-page recorder: everything window.__watch collects while a show plays.
// Injected with page.addInitScript(initScript, cfg) — the function is
// serialized, so it must be fully self-contained (no imports, no closures).
//
// Every anomaly record carries songT (the audio playhead) so triage can say
// "seek to 84s" instead of "somewhere in the run".

export function initScript(cfg) {
  // cfg: { perf: "lite" | "full" | null }
  try {
    if (cfg.perf) localStorage.setItem("x1c7-perf", cfg.perf);
    sessionStorage.setItem("x1c7-boot-seen", "1"); // skip the bootloader
  } catch {}

  const W = (window.__watch = {
    audios: [],
    gaps: [],        // rAF gap floats (ms), in order
    syncs: [],       // { i: gap index, songT } every 60 frames
    bigGaps: [],     // { gap, songT } for gaps > 50ms
    captures: [],    // wall ts of each screenshot (exclusion windows)
    longtasks: [],   // { dur, songT }
    errors: [],      // { msg, songT }  (page errors; console captured Node-side)
    ctxLost: [],     // { kind, songT }
    stalls: [],      // { songT, readyState, at }
    imgBad: [],      // { src, kind, songT }
    overflow: [],    // { word, edge, px, songT }
    nanStyles: [],   // { tag, cls, songT }
  });

  W.audio = () => {
    const list = W.audios.filter((a) => a.src && (a.duration > 30 || !isFinite(a.duration)));
    // The show's element is the playing one; if all are paused, the one with
    // the furthest playhead (a hover-preview sits parked at 0 or a hot moment).
    return list.find((a) => !a.paused)
      ?? list.slice().sort((x, y) => y.currentTime - x.currentTime)[0]
      ?? null;
  };
  W.songT = () => {
    const a = W.audio();
    return a ? +a.currentTime.toFixed(2) : -1;
  };

  // Audio constructor hook — the player builds its element off-DOM.
  const OrigAudio = window.Audio;
  window.Audio = function (...args) {
    const el = new OrigAudio(...args);
    W.audios.push(el);
    return el;
  };
  window.Audio.prototype = OrigAudio.prototype;

  // rAF gap recorder. One songT sync per 60 frames — reading currentTime per
  // frame would itself cost measurable time.
  let last = 0;
  const tick = (now) => {
    if (last) {
      const gap = now - last;
      W.gaps.push(gap);
      // wall stamp lets the analyzer place each gap on the same clock as
      // captures (screenshot encoding janks the page; those gaps are excluded).
      if (W.gaps.length % 60 === 1) W.syncs.push({ i: W.gaps.length - 1, songT: W.songT(), wall: now });
      if (gap > 50) W.bigGaps.push({ gap: +gap.toFixed(1), songT: W.songT() });
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  W.markCapture = () => {
    W.captures.push(performance.now());
    // Sampled DOM scans piggyback on capture moments (a MutationObserver would
    // fire per framer-motion style write and jank the page itself).
    try {
      const stage = document.querySelector(".kinetic-stage") ?? document.body;
      const els = stage.querySelectorAll("*");
      const vw = window.innerWidth;
      const n = Math.min(els.length, 900);
      for (let i = 0; i < n; i++) {
        const el = els[i];
        const st = el.getAttribute("style");
        if (st && /NaN|Infinity/.test(st) && !el.__watchNaN) {
          el.__watchNaN = true;
          W.nanStyles.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), songT: W.songT() });
        }
      }
      for (const el of document.querySelectorAll(".kinetic-word")) {
        const o = parseFloat(getComputedStyle(el).opacity);
        if (o < 0.5) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const overL = -r.left, overR = r.right - vw;
        const px = Math.max(overL, overR);
        if (px > 12) W.overflow.push({ word: (el.textContent || "").slice(0, 24), edge: overL > overR ? "left" : "right", px: Math.round(px), songT: W.songT() });
      }
    } catch {}
  };

  // Long tasks (Chromium; WebKit has no longtask entry — guard keeps it quiet).
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) W.longtasks.push({ dur: Math.round(e.duration), songT: W.songT() });
    }).observe({ entryTypes: ["longtask"] });
  } catch {}

  window.addEventListener("error", (e) => W.errors.push({ msg: String(e.message).slice(0, 300), songT: W.songT() }));
  window.addEventListener("unhandledrejection", (e) => W.errors.push({ msg: "unhandledrejection: " + String(e.reason).slice(0, 280), songT: W.songT() }));

  // Canvas context loss — patch getContext so every canvas gets listeners.
  const origGet = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    if (!this.__watchCtx) {
      this.__watchCtx = true;
      this.addEventListener("webglcontextlost", () => W.ctxLost.push({ kind: "webgl", songT: W.songT() }));
      this.addEventListener("contextlost", () => W.ctxLost.push({ kind: "2d", songT: W.songT() }));
    }
    return origGet.apply(this, args);
  };

  // Audio stall: playing but the playhead frozen for 3 consecutive checks (1.5s
  // — far above any localhost buffering blip).
  let lastT = -1, still = 0;
  setInterval(() => {
    const a = W.audio();
    // readyState < 2 = still fetching — that's loading, not a stall.
    if (!a || a.paused || a.ended || a.readyState < 2) { still = 0; return; }
    if (Math.abs(a.currentTime - lastT) < 0.05) {
      still++;
      if (still === 3) W.stalls.push({ songT: +a.currentTime.toFixed(2), readyState: a.readyState, at: Date.now() });
    } else still = 0;
    lastT = a.currentTime;
  }, 500);

  // Backdrop image health: broken src, or a decode that never lands.
  const pending = new Map(); // img -> first-seen-incomplete wall time
  setInterval(() => {
    for (const im of document.querySelectorAll("div.fixed.inset-0 img")) {
      if (im.complete && im.naturalWidth === 0 && !im.__watchBad) {
        im.__watchBad = true;
        W.imgBad.push({ src: im.src.split("/").slice(-2).join("/"), kind: "broken", songT: W.songT() });
      }
      if (!im.complete) {
        if (!pending.has(im)) pending.set(im, performance.now());
        else if (performance.now() - pending.get(im) > 4000 && !im.__watchStuck) {
          im.__watchStuck = true;
          W.imgBad.push({ src: im.src.split("/").slice(-2).join("/"), kind: "stuck", songT: W.songT() });
        }
      } else pending.delete(im);
    }
  }, 1000);

  W.dump = () => ({
    audios: W.audios.map((a) => ({
      src: decodeURIComponent(a.src.split("/").pop() || "").slice(0, 40),
      paused: a.paused, t: +a.currentTime.toFixed(2), rs: a.readyState,
      err: a.error ? a.error.code : null, xo: a.crossOrigin, pre: a.preload,
    })),
    gaps: W.gaps, syncs: W.syncs, bigGaps: W.bigGaps, captures: W.captures,
    longtasks: W.longtasks, errors: W.errors, ctxLost: W.ctxLost, stalls: W.stalls,
    imgBad: W.imgBad, overflow: W.overflow, nanStyles: W.nanStyles,
    ua: navigator.userAgent, dpr: window.devicePixelRatio,
    viewport: window.innerWidth + "x" + window.innerHeight,
    lite: document.body.classList.contains("perf-lite"),
  });
}

/** Node-side collectors: console errors/warnings + failed requests, tagged
 * with songT. Optional planet extras (gallery/guided/stems .json) 404 by
 * design — recorded once as info, never as anomalies. */
const OPTIONAL_404 = /\/(gallery|guided|stems)\.json$|\/planets\/.*\.(json)$/;
export function attachNodeCollectors(page, sink) {
  page.on("pageerror", async (e) => {
    const songT = await page.evaluate(() => window.__watch?.songT() ?? -1).catch(() => -1);
    sink.push({ type: "pageerror", msg: String(e.message).slice(0, 300), songT });
  });
  const seen404 = new Set();
  page.on("response", async (r) => {
    if (r.status() < 400) return;
    const url = r.url();
    if (seen404.has(url)) return;
    seen404.add(url);
    const optional = OPTIONAL_404.test(url);
    const songT = await page.evaluate(() => window.__watch?.songT() ?? -1).catch(() => -1);
    sink.push({ type: optional ? "info.optional-404" : "http." + r.status(), msg: url.slice(-120), songT });
  });
  page.on("console", async (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const txt = m.text();
    if (/Download the React DevTools|third-party cookies/i.test(txt)) return;
    // Resource-load 404s are reported (with the URL) by the response listener.
    if (/Failed to load resource/.test(txt)) return;
    const songT = await page.evaluate(() => window.__watch?.songT() ?? -1).catch(() => -1);
    sink.push({ type: "console." + m.type(), msg: txt.slice(0, 300), songT });
  });
}

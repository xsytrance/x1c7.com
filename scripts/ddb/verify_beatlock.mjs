#!/usr/bin/env node
// Prove the backdrop is cutting ON THE BEAT, by measurement rather than vibes.
//
// Watches the live stage, records the audio time of every backdrop change, and
// reports how far each landed from the nearest beat in the song's own grid.
// Run it against a track with deck.motion.quantize set and again with it off —
// the error distribution is the whole story.
//
//   node scripts/ddb/verify_beatlock.mjs <track> <from> <secs>
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const [track, from, secs] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4] ?? 20)];
const senses = JSON.parse(readFileSync("scripts/song-analysis/profiles/days-drift-by/senses.json", "utf8"));
const BEATS = senses.beats;

const browser = await chromium.launch({ args: ["--use-angle=vulkan", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
// The player builds DETACHED `new Audio()` objects — there is no <audio> in the
// DOM, so querySelector finds nothing and every sample comes back timeless.
// render-cut.mjs solves it the same way: hook the constructor before load.
await page.addInitScript(() => {
  window.__audios = [];
  const A = window.Audio;
  const W = function (...a) { const el = new A(...a); window.__audios.push(el); return el; };
  W.prototype = A.prototype;
  window.Audio = W;
});
await page.goto(`http://localhost:3218/studio?track=${track}&embed=1&autoplay=1&pass=6&mode=dynamic&t=${from}`,
  { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// Sample the painted backdrop and the audio clock together, fast enough that
// the sample interval is well under a beat (~511ms here).
const samples = await page.evaluate(async (ms) => {
  const out = [];
  const audio = (window.__audios || []).filter((a) => a.src && a.duration)[0]
    || (window.__audios || [])[0];
  const bg = () => {
    const el = [...document.querySelectorAll("img,div")]
      .find((e) => (e.tagName === "IMG" ? e.src : getComputedStyle(e).backgroundImage).includes("/planets/"));
    return el ? (el.tagName === "IMG" ? el.src : getComputedStyle(el).backgroundImage) : "";
  };
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    out.push({ t: audio ? audio.currentTime : -1, url: bg() });
    await new Promise((r) => setTimeout(r, 40));
  }
  return out;
}, secs * 1000);

await browser.close();

const changes = [];
for (let i = 1; i < samples.length; i++) {
  if (samples[i].url && samples[i].url !== samples[i - 1].url && samples[i].t > 0) {
    changes.push(samples[i].t);
  }
}
if (!changes.length) {
  console.log("no backdrop changes captured — is the window right and art wired?");
  process.exit(1);
}
const errs = changes.map((t) => {
  const b = BEATS.reduce((a, c) => (Math.abs(c - t) < Math.abs(a - t) ? c : a), BEATS[0]);
  return Math.abs(b - t) * 1000;
});
errs.sort((a, b) => a - b);
const med = errs[Math.floor(errs.length / 2)];
const period = ((BEATS[BEATS.length - 1] - BEATS[0]) / (BEATS.length - 1)) * 1000;
console.log(`${changes.length} backdrop changes over ${secs}s of ${track}`);
console.log(`beat period ${period.toFixed(0)}ms · sampling every 40ms`);
console.log(`distance to the nearest beat: median ${med.toFixed(0)}ms · worst ${errs[errs.length - 1].toFixed(0)}ms`);
console.log(`\nrandom cutting would average ~${(period / 4).toFixed(0)}ms off the beat.`);
console.log(med < period / 6 ? "LOCKED — changes are landing on the grid." : "NOT locked — no better than chance.");

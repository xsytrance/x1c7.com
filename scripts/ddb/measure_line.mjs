#!/usr/bin/env node
// Measure the phrase line in the REAL portrait stage at a given time.
//
// Written because two frames disagreed: a 27-character five-word line fitted
// inside 1080px, and an 18-character three-word line ran off the right edge.
// Reading the DOM settles which of font size, wrapping, the scale(1.22) on the
// sung word, or a word FX is actually responsible, instead of inferring it from
// pixels.
//
//   node scripts/ddb/measure_line.mjs <t> [<t> ...]
import { chromium } from "playwright";

const BASE = "http://localhost:3218";
const TRACK = "days-drift-by-cut";
const times = process.argv.slice(2).map(Number);

const browser = await chromium.launch({ args: ["--use-angle=vulkan"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

for (const t of times) {
  await page.goto(`${BASE}/studio?track=${TRACK}&embed=1&autoplay=1&pass=6&mode=dynamic&t=${t}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".phrase-line", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const line = document.querySelector(".phrase-line");
    if (!line) return { missing: true };
    const lr = line.getBoundingClientRect();
    const cs = getComputedStyle(line);
    const words = [...line.querySelectorAll(".phrase-word")].map((w) => {
      const r = w.getBoundingClientRect();
      return { t: w.textContent, x: Math.round(r.x), w: Math.round(r.width), y: Math.round(r.y), fs: getComputedStyle(w).fontSize };
    });
    return {
      text: line.textContent, vw: innerWidth,
      lineX: Math.round(lr.x), lineW: Math.round(lr.width),
      maxW: cs.maxWidth, gap: cs.columnGap, wrap: cs.flexWrap,
      scrollW: line.scrollWidth, clientW: line.clientWidth, words,
    };
  });
  if (info.missing) { console.log(`t=${t}  NO .phrase-line`); continue; }
  const rows = new Set(info.words.map((w) => w.y));
  const right = Math.max(...info.words.map((w) => w.x + w.w));
  const left = Math.min(...info.words.map((w) => w.x));
  console.log(`\nt=${t}  "${info.text}"`);
  console.log(`  viewport ${info.vw}  line x=${info.lineX} w=${info.lineW}  max-width=${info.maxW}  gap=${info.gap}  wrap=${info.wrap}`);
  console.log(`  scrollW=${info.scrollW} clientW=${info.clientW}  rows=${rows.size}  painted span ${left}..${right}`);
  if (right > info.vw || left < 0) console.log(`  *** OVERFLOWS THE ${info.vw}px FRAME by ${Math.max(0, right - info.vw)}px right / ${Math.max(0, -left)}px left`);
  for (const w of info.words) console.log(`    ${String(w.t).padEnd(12)} x=${String(w.x).padStart(5)} w=${String(w.w).padStart(4)} y=${w.y} fs=${w.fs}`);
}
await browser.close();

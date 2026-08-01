// Measure every phrase line in the cut window at the render's exact viewport.
//
// The 9:16 stills showed words touching the right edge. §10 blames overrun on
// >7-word lines, but that rule was written at 1920px; this cut is 1080px wide,
// so a 5-word line of long words can overrun too. Guessing from a downscaled
// frame is unreliable — this reads the real geometry out of the DOM.
//
// Reports, per line: the flex box width vs its max-width, and the furthest
// right any word reaches INCLUDING the active word's scale(1.22) transform,
// which flex layout does not account for.
import { chromium } from "playwright";
import { db } from "./_db.mjs";

const W = 1080, H = 1948, FROM = 233.10, TO = 303.20, SAFE = 24;

const { data } = await db.from("tracks").select("lyrics").eq("id", "different-this-summer").single();
const stamps = [];
for (const l of data.lyrics.split("\n")) {
  const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
  if (!m) continue;
  const t = +m[1] * 60 + +m[2];
  if (t >= FROM && t <= TO) stamps.push({ t, text: m[3] });
}

const b = await chromium.launch({ args: ["--headless=new"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const probe = async (t) => {
  await p.goto(`http://localhost:3218/studio?track=different-this-summer&embed=1&autoplay=1&pass=6&mode=phrase&t=${t}`,
    { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(8500);
  return p.evaluate(() => {
    const el = document.querySelector(".phrase-word");
    if (!el) return null;
    const line = el.parentElement;
    const kids = [...line.children];
    const r = line.getBoundingClientRect();
    return {
      text: kids.map((c) => c.textContent).join(" "),
      boxW: Math.round(r.width),
      maxW: Math.round(parseFloat(getComputedStyle(line).maxWidth)),
      far: Math.round(Math.max(...kids.map((c) => c.getBoundingClientRect().right))),
      near: Math.round(Math.min(...kids.map((c) => c.getBoundingClientRect().left))),
      rows: new Set(kids.map((c) => Math.round(c.getBoundingClientRect().top))).size,
    };
  });
};

console.log(`viewport ${W}px   safe margin ${SAFE}px each side\n`);
console.log("t       rows  boxW/maxW   left right   verdict   line");
let bad = 0;
for (const s of stamps) {
  const m = await probe(s.t + 0.25);
  if (!m) { console.log(`${s.t.toFixed(2)}  -- no line on stage --  ${s.text}`); continue; }
  const over = m.far > W - SAFE || m.near < SAFE;
  if (over) bad++;
  console.log(
    `${s.t.toFixed(2)}  ${String(m.rows).padStart(2)}   ${String(m.boxW).padStart(4)}/${m.maxW}  ` +
    `${String(m.near).padStart(4)} ${String(m.far).padStart(5)}   ${over ? "OVERRUN " : "ok      "}  ${m.text}`
  );
}
console.log(`\n${bad} of ${stamps.length} lines overrun the safe area`);
await b.close();

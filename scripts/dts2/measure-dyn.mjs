// Measure the giant DYNAMIC word at the render viewport.
//
// "TIME" kept losing its T off the left edge even after changing its FX, so
// stop guessing: report every text-bearing element on stage with its real
// viewport rect, so we can see WHICH element overhangs and by how much.
import { chromium } from "playwright";

const W = 1080, H = 1948;
const TIMES = process.argv.slice(2).map(Number);
if (!TIMES.length) TIMES.push(240.0, 244.0, 295.4, 300.6);

const b = await chromium.launch({ args: ["--headless=new"] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

for (const t of TIMES) {
  await p.goto(`http://localhost:3218/studio?track=different-this-summer&embed=1&autoplay=1&pass=6&mode=dynamic&t=${t}`,
    { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(9000);
  const r = await p.evaluate((VW) => {
    const out = [];
    for (const el of document.querySelectorAll("span,div")) {
      const txt = (el.textContent || "").trim();
      if (!txt || txt.length > 24 || el.children.length > 2) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 120 || b.height < 60) continue;      // giant type only
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 40) continue;
      out.push({
        txt, fs: Math.round(fs),
        l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width),
        cls: (el.className || "").toString().slice(0, 46),
        over: b.left < 0 || b.right > VW,
      });
    }
    return out;
  }, W);
  console.log(`\n── t=${t}  (viewport ${W})`);
  if (!r.length) console.log("   (no giant type on stage)");
  for (const x of r) {
    console.log(`   ${x.over ? "OVERHANGS" : "   ok    "} "${x.txt}"  ${x.fs}px  l=${x.l} r=${x.r} w=${x.w}  ${x.cls}`);
  }
}
await b.close();

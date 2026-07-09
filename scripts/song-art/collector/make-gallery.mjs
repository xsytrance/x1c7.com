#!/usr/bin/env node
// Build the review gallery (single self-contained HTML, images inlined).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
const b64 = (p, mime) => `data:${mime};base64,${readFileSync(p).toString("base64")}`;

function classify(genre) {
  const g = (genre || "").toLowerCase();
  if (!g) return "ARCHIVE";
  if (g.includes("r&b")) return "R&B";
  if (g.includes("hip")) return "HIP-HOP";
  if (g.includes("reggaeton") || g.includes("latin") || g.includes("dembow")) return "LATIN";
  if (g.includes("house")) return "HOUSE";
  if (g.includes("techno") || g.includes("industrial")) return "TECHNO";
  if (g.includes("rock") || g.includes("alternative")) return "ROCK";
  if (g.includes("afro")) return "AFROBEAT";
  if (g.includes("synthwave")) return "SYNTHWAVE";
  if (g.includes("lo-fi")) return "LO-FI";
  if (g.includes("ambient")) return "AMBIENT";
  if (g.includes("cinematic")) return "CINEMATIC";
  if (g.includes("pop")) return "POP";
  if (g.includes("dance")) return "DANCE";
  if (g.includes("electronic") || g.includes("edm")) return "ELECTRONIC";
  return "ARCHIVE";
}

const shelfSmall = join(HERE, "out", "shelf-web.webp");
await sharp(join(HERE, "out", "shelf.png")).resize(2600).webp({ quality: 74 }).toFile(shelfSmall);

const cards = manifest.map((t) => {
  const newT = join(HERE, "thumbs", `${t.slug}.webp`);
  const origT = join(HERE, "thumbs", `orig-${t.coverFile.replace(/\.png$/, "").replace(/[^a-zA-Z0-9-]/g, "_")}.webp`);
  if (!existsSync(newT) || !existsSync(origT)) { console.error("missing thumb for", t.slug); return null; }
  const spine = classify(t.genre);
  const meta = [t.bpm && `${t.bpm} BPM`, t.runtime, t.lang, t.geo].filter(Boolean).join(" · ");
  return { slug: t.slug, title: t.title, spine, meta, unreleased: !!t.unreleased, n: b64(newT, "image/webp"), o: b64(origT, "image/webp") };
}).filter(Boolean);

const genres = [...new Set(cards.map((c) => c.spine))].sort();
const font = readFileSync(join(HERE, "fonts", "BebasNeue-Regular.ttf")).toString("base64");

const html = `<title>AGENOR Collector Covers</title>
<style>
@font-face{font-family:'Bebas Neue';src:url(data:font/ttf;base64,${font}) format('truetype')}
:root{--case:#0b0b0d;--panel:#131316;--line:#2a2a20;--gold:#d4af37;--gold-hi:#f0d878;--ink:#efe6cf;--dim:#8f8a7c;--red:#c94a3a}
*{box-sizing:border-box}
body{margin:0;background:var(--case);color:var(--ink);font:15px/1.5 "Barlow Condensed","Arial Narrow",system-ui,sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:0 20px 80px}
header{padding:34px 0 10px;text-align:center}
.eyebrow{letter-spacing:.42em;color:var(--gold);font-size:13px;text-transform:uppercase}
h1{font-family:'Bebas Neue';font-size:clamp(38px,6vw,64px);letter-spacing:.06em;margin:.1em 0 .05em;color:var(--gold-hi);text-wrap:balance}
h1 .amp{color:var(--red)}
.sub{color:var(--dim);max-width:62ch;margin:0 auto 6px}
.shelf{border:1px solid var(--line);border-radius:6px;overflow-x:auto;margin:22px 0 8px;background:#000}
.shelf img{display:block;height:340px;width:auto;max-width:none}
.hint{color:var(--dim);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;text-align:center;margin-bottom:26px}
.chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:8px 0 26px}
.chip{font:16px 'Bebas Neue';letter-spacing:.12em;padding:7px 15px 5px;border:1px solid var(--line);border-radius:3px;background:var(--panel);color:var(--dim);cursor:pointer}
.chip:hover{color:var(--ink);border-color:var(--gold)}
.chip.on{color:#0b0b0d;background:var(--gold);border-color:var(--gold)}
.chip:focus-visible{outline:2px solid var(--gold-hi);outline-offset:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:5px;overflow:hidden}
.card figure{margin:0;position:relative;cursor:pointer}
.card img{display:block;width:100%;aspect-ratio:1/1}
.flag{position:absolute;top:8px;left:8px;font-size:11px;letter-spacing:.18em;background:#000c;color:var(--gold);padding:3px 8px;border-radius:2px;text-transform:uppercase}
.card figure::after{content:"CLICK · ORIGINAL";position:absolute;right:8px;bottom:8px;font-size:10.5px;letter-spacing:.16em;color:#fff9;background:#0009;padding:3px 7px;border-radius:2px;opacity:0;transition:opacity .15s}
@media(hover:hover){.card figure:hover::after{opacity:1}}
.card.showing-orig figure::after{content:"CLICK · COLLECTOR"}
.cap{padding:10px 12px 12px;border-top:1px solid var(--line)}
.cap b{display:block;font-family:'Bebas Neue';font-size:21px;letter-spacing:.05em;font-weight:400;color:var(--ink)}
.cap .m{color:var(--dim);font-size:13px;letter-spacing:.05em}
.badge{display:inline-block;font-size:11px;letter-spacing:.14em;color:var(--gold);border:1px solid var(--line);padding:1px 7px;border-radius:2px;margin-top:6px;text-transform:uppercase}
.badge.un{color:var(--dim)}
footer{margin-top:46px;text-align:center;color:var(--dim);font-size:13px;letter-spacing:.1em}
footer b{color:var(--gold)}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Agenor presents</div>
  <h1>THE COLLECTOR CATALOG <span class="amp">·</span> 53 COVERS</h1>
  <p class="sub">Every original stays intact. The case around it is data: genre-coded spine, verified BPM and runtime, the song's true waveform, language and region markers, Braille that really encodes the genre.</p>
</header>
<div class="shelf"><img src="${b64(shelfSmall, "image/webp")}" alt="All 53 collector spines lined up like a game shelf"></div>
<div class="hint">The shelf — scroll sideways. Same publisher, different worlds.</div>
<div class="chips" role="tablist">
  <button class="chip on" data-g="ALL">All (${cards.length})</button>
  ${genres.map((g) => `<button class="chip" data-g="${g}">${g} (${cards.filter((c) => c.spine === g).length})</button>`).join("\n  ")}
</div>
<div class="grid">
${cards.map((c) => `<div class="card" data-g="${c.spine}">
  <figure title="Toggle original / collector">
    <img loading="lazy" src="${c.n}" data-n="${c.n}" data-o="${c.o}" alt="${c.title} collector cover">
    <span class="flag">${c.spine}</span>
  </figure>
  <div class="cap"><b>${c.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</b>
  <span class="m">${c.meta || "—"}</span>
  ${c.unreleased ? '<br><span class="badge un">Unreleased · Archive Edition</span>' : ""}</div>
</div>`).join("\n")}
</div>
<footer><b>AGENOR COLLECTOR COVER SYSTEM</b> · engine: scripts/song-art/collector/engine.mjs · no invented metadata — every number verified or omitted</footer>
</div>
<script>
document.querySelectorAll('.chip').forEach(ch=>ch.addEventListener('click',()=>{
  document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));ch.classList.add('on');
  const g=ch.dataset.g;
  document.querySelectorAll('.card').forEach(c=>c.style.display=(g==='ALL'||c.dataset.g===g)?'':'none');
}));
document.querySelectorAll('.card figure').forEach(f=>f.addEventListener('click',()=>{
  const img=f.querySelector('img'),card=f.closest('.card');
  const showOrig=img.src!==img.dataset.o;
  img.src=showOrig?img.dataset.o:img.dataset.n;
  card.classList.toggle('showing-orig',showOrig);
}));
</script>`;

const out = process.argv[2] || join(HERE, "gallery.html");
writeFileSync(out, html);
console.error(`gallery: ${out} (${(html.length / 1048576).toFixed(1)} MB, ${cards.length} cards)`);

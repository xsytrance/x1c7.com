#!/usr/bin/env node
// ROOKLYN SERIES — cover art in the established Rooklyn voice.
//
// Supersedes collector/yeah-its-ai-cover.mjs, which was wrong on every axis that
// matters. That script invented a photoreal 1920s noir dock with a human man in a
// trench coat. Rooklyn is not a man. Getting this right means copying, not
// inventing, so this script works image-to-image off a reference cover.
//
// ROOKLYN, as established by originals/Still Got 5 On It.png and
// Jayodeed - Going Crazy (Rooklyn Mix):
//   • a CROW. Black, inked, cartoon-illustrated — never photoreal, never human.
//   • flat newsboy cap with an "R"-under-crown patch.
//   • gold rope chain + a gold "R / ROOKLYN" pendant. A gold pocket watch, an R.
//   • heavy dark coat, permanent half-lidded scowl, long grey beak.
//   • world: 1928 dockside, steamboats, smokestacks, moon, chains, brick,
//     hand-painted shop signage. NYC skyline behind the fog.
//   • THE RULE: black and white world, but the money still gold. Gold is the ONLY
//     colour and it lands on money, chain, pendant, crown — nothing else.
//   • the jokes live in the signage. "INFLATION IS A HEIST". "CROW'S SMOKE SHOP —
//     FINE HERB & GOODS". "NO LOVE / NO TRUST / JUST THE RIVER". Write new ones.
//   • the title is hand-lettered INTO the art — distressed slab, one word picked
//     out in cracked gold leaf, drips. It is not typeset afterward.
//   • the covers are bespoke: they carry their own AGENOR PRESENTS header, genre
//     spine and footer. engine.mjs passes finished/<slug>.png through verbatim
//     (engine.mjs:80), so the art must include the frame.
//
// Why nano-banana-pro and not local SDXL: character consistency. DreamShaperXL
// cannot hold a specific crow's costume across a new scene, and the local --gen
// pass could not even hold "monochrome except gold". nano-banana-pro carried
// Tyler's likeness where Kontext failed (DTTG, 2026-08-01) and takes image_url
// SINGULAR — one reference, not an array.
//
//   node rooklyn-cover.mjs --gen "yeah-its-ai-why" --n 2
//   node rooklyn-cover.mjs --contact "yeah-its-ai-why"

import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const COLLECTOR = join(HERE, "collector");
const GEN = join(COLLECTOR, "gen");
mkdirSync(GEN, { recursive: true });

// The character reference. Every Rooklyn cover starts from an existing one so the
// crow stays the same crow.
const REF = join(COLLECTOR, "originals", "Still Got 5 On It.png");

const AIML = "https://api.aimlapi.com/v1";
const MODEL = "google/nano-banana-pro";
const UA = "Mozilla/5.0 (X11; Linux x86_64) x1c7-cover/1.0";
const key = () => readFileSync(join(homedir(), ".bfl_key"), "utf8").trim();

// ── the briefs ───────────────────────────────────────────────────────────────
// Each entry says what CHANGES from the reference. The character, medium, palette
// and framing are held constant by the shared spine below.
const BRIEFS = {
  "yeah-its-ai-why": {
    title: "Yeah It's A.I. (Why?)",
    goldWord: "A.I.",
    scene: [
      "Rooklyn stands outside a dingy 1928 storefront whose hand-painted sign reads",
      "\"ROOKLYN A.I. — GENUINE IMITATION\". He is holding up a cheap tin robot crow",
      "puppet on strings — an obvious fake of himself, same cap, same chain, but",
      "dead-eyed and riveted together — and staring at it with utter contempt.",
      "Behind him a vending machine dispenses identical boxed crow dolls stacked to",
      "the ceiling. A gramophone horn wired to a mess of cables plays to nobody.",
      "A painted wall advert reads \"THE MACHINE DON'T SWEAT\" and a smaller stencil",
      "on a crate reads \"EVERY VOICE FOR SALE\".",
    ].join(" "),
  },
};

// Held constant across the series. This is the part that must not drift.
const SPINE = [
  "Keep the EXACT same character: the same black crow, same inked cartoon",
  "illustration style, same newsboy cap with the R-under-crown patch, same gold",
  "rope chain and gold R ROOKLYN pendant, same heavy dark coat, same half-lidded",
  "scowl and long grey beak. Same 1928 dockside world — steamboats, smokestacks,",
  "moon, chains, brick, hand-painted signage, city skyline in the fog.",
  "Same grade: high-contrast black and white, heavy grain, aged paper, ink drips.",
  "GOLD IS THE ONLY COLOUR IN THE IMAGE and it appears ONLY on money, his chain,",
  "his pendant and crowns. Everything else is pure monochrome — no sepia, no brown.",
  "Keep the same album packaging: the thin gold border, the black AGENOR PRESENTS",
  "header bar at the top with gold diamonds, the dark vertical genre spine down the",
  "left edge with the gold AGENOR sun-crest, and the PARENTAL ADVISORY badge.",
].join(" ");

const lettering = (b) =>
  [`Hand-letter the title "${b.title}" large across the upper area in the same`,
   `distressed vintage slab lettering, with "${b.goldWord}" picked out in cracked`,
   `gold leaf with drips, and a small hand-lettered "ROOKLYN" banner ribbon beneath it.`,
  ].join(" ");

async function post(payload) {
  const r = await fetch(`${AIML}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json",
               "User-Agent": UA, Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`aimlapi HTTP ${r.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

const urlOf = (o) => o?.images?.[0]?.url || o?.data?.[0]?.url || null;

async function render(prompt) {
  const uri = "data:image/png;base64," + readFileSync(REF).toString("base64");
  // image_url SINGULAR — nano-banana-pro rejects an array here.
  const r = await post({ model: MODEL, prompt, image_url: uri,
                         num_images: 1, output_format: "png" });
  let url = urlOf(r);
  const gid = r.id || r.generation_id;
  for (let i = 0; i < 60 && !url; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    const q = await fetch(`${AIML}/images/generations?generation_id=${gid}`,
                          { headers: { Authorization: `Bearer ${key()}`, "User-Agent": UA } });
    if (!q.ok) continue;
    const s = await q.json();
    url = urlOf(s);
    if (!url && ["failed", "error"].includes(s?.status)) throw new Error(`failed: ${JSON.stringify(s).slice(0, 300)}`);
  }
  if (!url) throw new Error("no url after polling");
  return Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
}

// Same black-plate guard as before: a uniform or tiny return is a billed failure.
async function reject(buf) {
  if (buf.length < 20000) return `only ${buf.length}B — black plate`;
  const { channels } = await sharp(buf).stats();
  const spread = Math.max(...channels.map((c) => c.max)) - Math.min(...channels.map((c) => c.min));
  return spread < 12 ? `near-uniform (spread ${spread}) — black plate` : null;
}

const mode = process.argv[2];
const slug = process.argv[3];
const brief = BRIEFS[slug];
if (!brief) {
  console.error(`usage: rooklyn-cover.mjs --gen|--contact <slug> [--n N]`);
  console.error(`known slugs: ${Object.keys(BRIEFS).join(", ")}`);
  process.exit(1);
}

if (mode === "--gen") {
  const ni = process.argv.indexOf("--n");
  const n = ni > 0 ? Number(process.argv[ni + 1]) : 2;
  // Vary only the camera, so the differences are compositional, not tonal.
  const angles = ["Medium shot, Rooklyn centred and dominant.",
                  "Wider street-level shot, more of the storefront and signage visible.",
                  "Low angle looking up at him, the machine towering behind."];
  for (let i = 0; i < n; i++) {
    const prompt = `${brief.scene} ${angles[i % angles.length]} ${SPINE} ${lettering(brief)}`;
    const buf = await render(prompt);
    const bad = await reject(buf);
    if (bad) { console.error(`✗ candidate ${i + 1}: ${bad} — not written (still billed)`); continue; }
    const f = join(GEN, `${slug}-rk${i + 1}.png`);
    writeFileSync(f, buf);
    console.error(`✔ candidate ${i + 1}/${n} → ${f} (${(buf.length / 1024 / 1024).toFixed(2)}MB)`);
  }
} else if (mode === "--regrade") {
  // The generate pass reliably comes back too LIGHT — bright cream line art that
  // reads like a newspaper strip. The series is near-black and grimy. Fixing this
  // by regenerating loses the composition, so regrade the chosen candidate in
  // place instead: same image, darker world.
  const ci = process.argv.indexOf("--cand");
  const cand = ci > 0 ? process.argv[ci + 1] : "rk1";
  const src = join(GEN, `${slug}-${cand}.png`);
  if (!existsSync(src)) { console.error(`no such candidate: ${src}`); process.exit(1); }
  const prompt = [
    "Keep the composition, characters, signage and all lettering EXACTLY as they are.",
    "Only change the grade: make the whole image much darker and grimier.",
    "Deep near-black shadows, a dark sooty night, heavy ink, aged and stained paper,",
    "strong film grain. The background should be dark, not white or cream.",
    "Gold stays the only colour and should now glow warmly against the dark.",
  ].join(" ");
  const uri = "data:image/png;base64," + readFileSync(src).toString("base64");
  const r = await post({ model: MODEL, prompt, image_url: uri, num_images: 1, output_format: "png" });
  let url = urlOf(r);
  const gid = r.id || r.generation_id;
  for (let i = 0; i < 60 && !url; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    const q = await fetch(`${AIML}/images/generations?generation_id=${gid}`,
                          { headers: { Authorization: `Bearer ${key()}`, "User-Agent": UA } });
    if (q.ok) url = urlOf(await q.json());
  }
  if (!url) { console.error("no url after polling"); process.exit(1); }
  const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
  const bad = await reject(buf);
  if (bad) { console.error(`✗ ${bad} — not written (still billed)`); process.exit(1); }
  const out = join(GEN, `${slug}-${cand}-dark.png`);
  writeFileSync(out, buf);
  console.error(`✔ regraded → ${out} (${(buf.length / 1024 / 1024).toFixed(2)}MB)`);
} else if (mode === "--contact") {
  const cell = 768;
  const tiles = [];
  for (let i = 1; i <= 6; i++) {
    const p = join(GEN, `${slug}-rk${i}.png`);
    if (existsSync(p)) tiles.push({ input: await sharp(p).resize(cell, cell).toBuffer(),
                                    left: ((tiles.length) % 2) * cell, top: Math.floor(tiles.length / 2) * cell });
  }
  if (!tiles.length) { console.error("no candidates yet"); process.exit(1); }
  const out = join(GEN, `${slug}-rk-contact.png`);
  await sharp({ create: { width: cell * 2, height: cell * Math.ceil(tiles.length / 2), channels: 3, background: "#000" } })
    .composite(tiles).png().toFile(out);
  console.error(`✔ contact → ${out}`);
} else {
  console.error("usage: rooklyn-cover.mjs --gen|--contact <slug> [--n N]");
  process.exit(1);
}

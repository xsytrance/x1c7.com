#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE BOOKLET BUILDER — liner notes × game manual, one insert per song.
//
// Reads the ultimate analyzer's profile.json (measured truth), curates world
// art from the planet gallery, and asks the LLM for the written matter only:
// liner notes, band bios, level names, a tagline. Everything is validated and
// clamped in code; facts on the specs pages come straight from the profile.
//
//   node scripts/booklet/build-booklet.mjs --id <slug> [--publish] [--force]
//
// Copy is CACHED at profiles/<id>/booklet-copy.json (dynamic-plus law: a
// rerun can never clobber the catalog; --force re-asks the LLM). Output:
// profiles/<id>/booklet.json → --publish ships to R2 planets/<id>/booklet.json
// where the /t page's 📖 button picks it up with zero deploys.
// ═══════════════════════════════════════════════════════════════════════════

import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const PROFILES = join(REPO, "scripts", "song-analysis", "profiles");
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const ID = opt("--id");
const MODEL = opt("--model", "qwen3.5:latest");
const log = (...a) => console.error(...a);
if (!ID) { log("usage: build-booklet.mjs --id <slug> [--publish] [--force]"); process.exit(2); }

const OUT = join(PROFILES, ID);
const profilePath = join(OUT, "profile.json");
if (!existsSync(profilePath)) { log(`✘ no profile for ${ID} — run the ultimate analyzer first`); process.exit(1); }
const p = JSON.parse(readFileSync(profilePath, "utf8"));

// ── stem labels (mirror of SonicDossier's — the band's stage names) ─────────
const STEM_LABEL = {
  lead: "LEAD VOX", back: "BACKING VOX", drums: "DRUMS", bass: "BASS", keys: "KEYS",
  perc: "PERCUSSION", synth: "SYNTH", guitar: "GUITAR", strings: "STRINGS",
  woodwinds: "WOODWINDS", brass: "BRASS", other: "TEXTURES",
};

// ── Camelot (baked into the data so the component stays dumb) ───────────────
const CAMELOT = {
  "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B", "E major": "12B", "B major": "1B",
  "F# major": "2B", "C# major": "3B", "G# major": "4B", "D# major": "5B", "A# major": "6B", "F major": "7B",
  "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A", "C# minor": "12A", "G# minor": "1A",
  "D# minor": "2A", "A# minor": "3A", "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
};
const FLAT = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

function llm(system, user) {
  const body = JSON.stringify({
    model: MODEL, stream: true, format: "json", think: false,
    options: { temperature: 0.7, num_ctx: 8192, num_predict: 1600 },
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  return new Promise((resolve, reject) => {
    const req = http.request(`${OLLAMA}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`LLM ${res.statusCode}`)); res.resume(); return; }
      let out = "", buf = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        buf += c; let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (line) try { out += JSON.parse(line).message?.content ?? ""; } catch { /* partial */ }
        }
      });
      res.on("end", () => {
        const a = out.indexOf("{"), b = out.lastIndexOf("}");
        if (a < 0 || b <= a) return reject(new Error(`no JSON: ${out.slice(0, 120)}`));
        try { resolve(JSON.parse(out.slice(a, b + 1))); } catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
}

// ── the copy pass (cached) ──────────────────────────────────────────────────
const sections = (p.analysis?.sections ?? []).filter((s) => typeof s.start === "number");
const stems = p.show?.performs?.stems ?? [];
const lyricWords = (p.lyrics?.text ?? "").trim().split(/\s+/).filter(Boolean);
const hasLyrics = lyricWords.length >= 20;

async function writeCopy() {
  const system = `You write the insert booklet for a collector-edition song — CD liner notes crossed with a retro video-game manual. Voice: warm, playful, a little reverent about the music; grounded ONLY in the facts given; never invent people, places, or events; never mention AI. Respond ONLY with JSON:
{"tagline": string, "liner": string, "worldCaption": string, "bios": {"<stem>": string}, "levels": [{"section": string, "name": string}]}
Rules:
- tagline: max 60 chars, the back-of-the-case hook line.
- liner: 120-180 words of liner notes — what the song is, the feeling, the journey. Written like it's printed on paper. No headings.
- worldCaption: max 140 chars, a caption for the song's world/art spread.
- bios: one entry PER STEM listed, keyed by the stem id EXACTLY as given (e.g. "drums", "lead") — the band member's character card bio, game-manual style: ONE short sentence, max 10 words, NEVER starting with or repeating the instrument name (e.g. "drums": "Keeps the floor shaking. Never misses a downbeat.").
- levels: one entry PER SECTION listed, name = a level name for that section, 2-4 punchy words, max 22 chars total, retro-manual flavor grounded in the section's real mood (e.g. "THE RISER GAUNTLET", "NEON COOLDOWN"). Keep the "section" field exactly as given.`;
  const user = `Song: "${p.identity?.title}" — ${p.identity?.genre}${p.identity?.subGenres?.length ? ` (${p.identity.subGenres.join(", ")})` : ""}. Mood: ${Array.isArray(p.identity?.mood) ? p.identity.mood.join(", ") : p.identity?.mood}. Energy: ${p.identity?.energy}. Vocal style: ${p.identity?.vocalStyle ?? "n/a"}.
Style sentence: ${p.identity?.styleSentence ?? ""}
Summary: ${p.analysis?.summary ?? ""}
Themes: ${(p.analysis?.themes ?? []).join(", ")}
Stems (the band): ${stems.map((s) => `${s} = ${STEM_LABEL[s] ?? s}`).join(", ") || "none"}
Sections: ${sections.map((s) => `"${s.name}" (${s.emotion ?? "?"}, intensity ${s.intensity ?? "?"})`).join("; ")}
${hasLyrics ? `Lyrics (excerpt):\n${(p.lyrics.text).slice(0, 1200)}` : "Instrumental — no lyrics."}`;
  return llm(system, user);
}

function validateCopy(raw) {
  const clamp = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  // clamp on a word boundary — a truncated level name reads as a typo
  const clampWord = (s, n) => {
    const t = clamp(s, n + 20);
    if (t.length <= n) return t;
    const cut = t.slice(0, n);
    return (cut.includes(" ") ? cut.slice(0, cut.lastIndexOf(" ")) : cut).trim();
  };
  const liner = String(raw?.liner ?? "").trim();
  if (liner.split(/\s+/).length < 40) throw new Error("liner too short");
  // accept bios keyed by stem id OR stage label, any case
  const stemKey = new Map(stems.flatMap((s) => [[s, s], [(STEM_LABEL[s] ?? s).toLowerCase(), s]]));
  const bios = {};
  for (const [k, v] of Object.entries(raw?.bios ?? {})) {
    const s = stemKey.get(String(k).toLowerCase().trim());
    if (s && v) bios[s] = clampWord(v, 80);
  }
  // coverage is scored by the caller — missing entries fall back to house bios
  const levels = {};
  const wanted = new Map(sections.map((s) => [s.name.toLowerCase(), s.name]));
  for (const l of Array.isArray(raw?.levels) ? raw.levels : []) {
    const key = wanted.get(String(l?.section ?? "").toLowerCase());
    if (key && l?.name) levels[key] = clampWord(l.name, 22).toUpperCase();
  }
  return {
    tagline: clamp(raw?.tagline, 60),
    liner: liner.slice(0, 1400),
    worldCaption: clamp(raw?.worldCaption, 140),
    bios, levels,
  };
}

// House bios — the fallback roster when the LLM shorts a band member.
const HOUSE_BIO = {
  lead: "Front and center. Carries the story.",
  back: "The echo that turns a chorus into a crowd.",
  drums: "Keeps the floor shaking. Never misses a downbeat.",
  bass: "The low end you feel in your chest.",
  perc: "Texture in the pocket, always moving.",
  synth: "Paints the sky behind the words.",
  keys: "Chords that hold the room together.",
  guitar: "Strings with an attitude.",
  strings: "The cinematic swell.",
  woodwinds: "Air and light between the beats.",
  brass: "The victory fanfare.",
  other: "Everything you feel but can't name.",
};

const copyCache = join(OUT, "booklet-copy.json");
let copy;
if (existsSync(copyCache) && !flag("--force")) {
  copy = JSON.parse(readFileSync(copyCache, "utf8"));
  log(`· copy from cache`);
} else {
  // two attempts, keep the one with better bios+levels coverage
  const coverage = (c) => (stems.length ? Object.keys(c.bios).length / stems.length : 1) + (sections.length ? Object.keys(c.levels).length / sections.length : 1);
  copy = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const c = validateCopy(await writeCopy());
      if (!copy || coverage(c) > coverage(copy)) copy = c;
      if (coverage(copy) >= 2) break;
      log(`· attempt ${attempt} coverage ${coverage(copy).toFixed(2)}/2 — ${attempt < 2 ? "trying again" : "keeping best"}`);
    } catch (e) { log(`· attempt ${attempt} failed (${e.message})`); }
  }
  if (!copy) throw new Error("copy pass failed twice");
  for (const s of stems) if (!copy.bios[s]) copy.bios[s] = HOUSE_BIO[s] ?? "Part of the machine.";
  writeFileSync(copyCache, JSON.stringify(copy, null, 1));
  log(`✔ copy written (${copy.liner.split(/\s+/).length} words, ${Object.keys(copy.bios).length} bios, ${Object.keys(copy.levels).length}/${sections.length} levels)`);
}

// ── world art — curate from the planet gallery (keyword buckets first) ──────
async function pickArt() {
  try {
    const g = await fetch(`${PUB}/planets/${ID}/gallery.json`).then((r) => (r.ok ? r.json() : null));
    if (!g?.art) return [];
    const hot = new Set([...(p.analysis?.keywords ?? []).map((k) => k.word?.toLowerCase()), ...(p.analysis?.themes ?? []).map((t) => t.toLowerCase())]);
    const buckets = Object.entries(g.art).sort(([a], [b]) => (hot.has(b) ? 1 : 0) - (hot.has(a) ? 1 : 0));
    const picks = [];
    for (let round = 0; picks.length < 6 && round < 3; round++)
      for (const [, imgs] of buckets) { if (imgs[round] && picks.length < 6) picks.push(PUB + imgs[round]); }
    return picks;
  } catch { return []; }
}
const art = await pickArt();

// ── page assembly (pure code; facts measured, vibes labeled) ────────────────
const bookletNo = (Array.from(ID).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4096).toString(16).toUpperCase().padStart(3, "0");
const dur = p.measured?.duration ?? null;
const ke = p.mixFeatures?.keyEstimate ?? {};
const camelot = ke.key && ke.mode ? CAMELOT[`${FLAT[ke.key] ?? ke.key} ${ke.mode.toLowerCase()}`] ?? null : null;
const cuts = p.show?.dropMap?.cuts ?? [];
const risers = p.show?.dropMap?.risers ?? [];
const dpPath = join(OUT, "dynamic-plus.json");
const dp = existsSync(dpPath) ? JSON.parse(readFileSync(dpPath, "utf8")) : null;

const levels = sections.map((s, i) => {
  const a = s.start ?? 0;
  const b = sections[i + 1]?.start ?? dur ?? a + 30;
  const boss = cuts.some(([c, d]) => c < b && d > a) || risers.some((r) => r.end > a && r.t < b);
  return { section: s.name, name: copy.levels[s.name] ?? s.name.toUpperCase(), start: Math.round(a), end: Math.round(b), intensity: s.intensity ?? 0.5, emotion: s.emotion ?? null, boss };
});

const worldPage = { type: "world", art, caption: copy.worldCaption, themes: p.analysis?.themes ?? [] };
const pages = [
  { type: "cover", title: p.identity?.title ?? ID, tagline: copy.tagline, genre: p.identity?.genre ?? null, bookletNo },
  { type: "read", body: copy.liner, styleSentence: p.identity?.styleSentence ?? null, mood: Array.isArray(p.identity?.mood) ? p.identity.mood : [p.identity?.mood].filter(Boolean) },
  ...(hasLyrics
    ? [{ type: "lyrics", official: !!p.lyrics?.official, language: p.lyrics?.language ?? null, text: p.lyrics.text }]
    : [{ ...worldPage, caption: "AN INSTRUMENTAL TRANSMISSION — THE WORLD SPEAKS FOR ITSELF" }]),
  ...(art.length ? [worldPage] : []),
  ...(stems.length ? [{ type: "band", approx: !!p.show?.performs?.approx, vocalStyle: p.identity?.vocalStyle ?? null, members: stems.map((s) => ({ stem: s, name: STEM_LABEL[s] ?? s.toUpperCase(), bio: copy.bios[s] ?? null })) }] : []),
  { type: "howto", performs: stems.length > 0 || hasLyrics, dynamicActs: dp?.acts?.length ?? 0, wordFx: dp ? Object.keys(dp.words ?? {}).length : 0, stems: stems.length },
  ...(levels.length > 1 ? [{ type: "map", duration: dur ? Math.round(dur) : null, levels }] : []),
  { type: "specs", bpm: p.measured?.bpm ? Math.round(p.measured.bpm) : null, key: ke.key ?? null, mode: ke.mode ?? null, camelot, duration: dur, energy: p.identity?.energy ?? null, dynamicsDb: p.mixFeatures?.dynamicsDb ?? null, brightness: p.mixFeatures?.brightness ?? null, officialLyrics: !!p.lyrics?.official, generatedAt: p.generatedAt ?? null },
  { type: "back", line: "AGENOR · THE COLLECTION", url: `x1c7.com/t/${ID}`, bookletNo },
];

const booklet = { v: 1, id: ID, generatedAt: p.generatedAt ?? null, pages };
writeFileSync(join(OUT, "booklet.json"), JSON.stringify(booklet, null, 1));
log(`✔ booklet.json — ${pages.length} pages (${pages.map((x) => x.type).join(", ")})`);

// ── publish (same rclone → R2 path as the analyzer) ─────────────────────────
if (flag("--publish")) {
  const eo = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
  execFileSync("rclone", ["copyto", join(OUT, "booklet.json"), `R2:${eo.BUCKET || "x1c7-music"}/planets/${ID}/booklet.json`, "--s3-no-check-bucket", "--no-traverse"], {
    env: {
      ...process.env,
      RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: eo.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: eo.SECRET_ACCESS_KEY,
      RCLONE_CONFIG_R2_ENDPOINT: eo.ENDPOINT,
    }, stdio: "inherit",
  });
  log(`↑ published → planets/${ID}/booklet.json`);
}

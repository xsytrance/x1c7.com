#!/usr/bin/env node
// Onboard a PUBLIC catalog song that already lives in R2 → a full planet.
// The sibling of import-youtube/import.mjs, minus the rip and the research:
// you already know the song (it's yours) — title, artist, R2 URLs, style.
//
// Pipeline: download (R2) → transcribe vocals w/ word timestamps (Whisper +
// demucs) → LLM section map (official lyrics as reference) → planet analysis
// (analyze.mjs) → touch choreography → keyword + section art (ComfyUI) →
// twins (variants.mjs) → row.sql (public, hidden=false).
//
// Usage:
//   node scripts/onboard-song.mjs --id veneno-y-miel --title "Veneno Y Miel" \
//     --audio-url "https://…r2.dev/MP3/Veneno%20Y%20Miel.mp3" \
//     --cover "https://…r2.dev/album-art/Art/Veneno%20Y%20Miel.png" \
//     --genre "Hip-Hop" --mood "Dark Seductive" \
//     --style "one-sentence text-to-image style hint" \
//     --lyrics-file official-lyrics.txt --venv ~/whisper-venv \
//     [--sort 40] [--lang en] [--no-demucs] [--skip-art] [--model qwen2.5:14b]
//
// Emits scripts/onboard-jobs/<id>/row.sql — apply via Supabase MCP/SQL editor.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const need = (k) => { if (!args[k] || args[k] === true) { console.error(`missing --${k}`); process.exit(1); } return args[k]; };
const id = need("id"), TITLE = need("title"), AUDIO_URL = need("audio-url");
const VENV = args.venv || process.env.WHISPER_VENV || `${process.env.HOME}/whisper-venv`;
const MODEL = args.model || "qwen2.5:14b";
const ARTIST = args.artist || "xsytrance";
const STYLE = args.style && args.style !== true ? args.style : null;
const log = (...a) => console.error(...a);
const toLrc = (sec) => {
  const mm = Math.floor(sec / 60), ss = Math.floor(sec % 60), cs = Math.round((sec % 1) * 100) % 100;
  return `[${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
};

async function llm(system, user, numPredict = 1200) {
  // stream:true so headers arrive immediately — stream:false only responds
  // after the FULL generation, and Node's fetch aborts at 300s on a slow or
  // contended GPU ("fetch failed").
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: true, format: "json", think: false,
      options: { temperature: 0.4, num_ctx: 8192, num_predict: numPredict },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  let raw = "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try { raw += JSON.parse(line).message?.content || ""; } catch { /* partial line */ }
    }
  }
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
}

// ── 1. DOWNLOAD ─────────────────────────────────────────────────────────────
const wd = resolve(args.workdir || join(HERE, "onboard-jobs", id));
mkdirSync(wd, { recursive: true });
const mp3 = join(wd, "audio.mp3");
if (!existsSync(mp3)) {
  log("▶ downloading from R2 …");
  execFileSync("curl", ["-sf", "-o", mp3, AUDIO_URL], { stdio: ["ignore", 2, 2] });
}
const duration = Math.round(Number(execFileSync("ffprobe", ["-v", "error",
  "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" })));
log(`  "${TITLE}" — ${duration}s → id "${id}"`);

// ── 2. TRANSCRIBE ───────────────────────────────────────────────────────────
// Best source wins: --vocal-stem (Suno's isolated lead vocal — cleaner than
// any separation we could do) > full mix. Stem timing is re-clocked onto the
// release via --stem-lag (seconds to ADD, from analyze_stems.py's align.lag).
const tPath = join(wd, "transcript.json");
const vocalStem = args["vocal-stem"] && args["vocal-stem"] !== true ? resolve(args["vocal-stem"]) : null;
const stemLag = Number(args["stem-lag"] ?? 0) || 0;
if (!existsSync(tPath)) {
  const src = vocalStem ?? mp3;
  log(`▶ transcribing vocals (Whisper large-v3, ${vocalStem ? "lead-vocal stem" : args["no-demucs"] ? "full mix" : "demucs"}) …`);
  const py = [join(HERE, "import-youtube/transcribe.py"), "--audio", src, "--out", tPath];
  if (args.lang && args.lang !== true) py.push("--language", args.lang);
  if (vocalStem || args["no-demucs"]) py.push("--no-demucs");
  const r = spawnSync(join(VENV, "bin/python"), py, { stdio: ["ignore", 2, 2] });
  if (r.status !== 0) throw new Error("transcription failed");
  if (vocalStem && stemLag) {
    const tr = JSON.parse(readFileSync(tPath, "utf8"));
    for (const s of tr.segments) {
      s.start = Math.max(0, Math.round((s.start + stemLag) * 1000) / 1000);
      if (s.end != null) s.end = Math.round((s.end + stemLag) * 1000) / 1000;
      for (const w of s.words ?? []) w.t = Math.max(0, Math.round((w.t + stemLag) * 1000) / 1000);
    }
    writeFileSync(tPath, JSON.stringify(tr, null, 2));
    log(`  re-clocked by ${stemLag > 0 ? "+" : ""}${stemLag}s onto the release`);
  }
}
const transcript = JSON.parse(readFileSync(tPath, "utf8"));
const segs = transcript.segments.filter((s) => s.text.trim());
// Whisper hallucinates over trailing silence/hums — pleasantries and
// wrong-script confetti alike. Trim from the tail only.
const GHOSTS = /^(thank(s| you)|thanks for (watching|listening)|subscribe|bye|see you)[.! ]*$/i;
const WRONG_SCRIPT = /[Ѐ-ӿ一-鿿؀-ۿ]/;
while (segs.length && (GHOSTS.test(segs[segs.length - 1].text.trim()) || WRONG_SCRIPT.test(segs[segs.length - 1].text))) segs.pop();
if (!segs.length) throw new Error("no vocals transcribed");
// Optional song-specific mishear fixes: --fix-file <json> = [{find, replace, flags?}].
// Applied to line text; word tokens are rebuilt on the original timestamps
// (extra tokens interpolate across the line).
if (args["fix-file"] && args["fix-file"] !== true) {
  const fixes = JSON.parse(readFileSync(resolve(args["fix-file"]), "utf8"));
  let fixed = 0;
  for (const s of segs) {
    let txt = s.text;
    for (const f of fixes) txt = txt.replace(new RegExp(f.find, f.flags ?? "gi"), f.replace);
    if (txt.trim() !== s.text.trim()) {
      fixed++;
      const toks = txt.trim().split(/\s+/);
      const times = (s.words ?? []).map((w) => w.t);
      const t0 = times[0] ?? s.start, t1 = s.end ?? t0 + 2;
      s.text = txt.trim();
      s.words = toks.map((w, i) => ({
        t: times[i] ?? Math.round((t0 + ((t1 - t0) * i) / Math.max(1, toks.length)) * 1000) / 1000,
        text: w,
      }));
    }
  }
  log(`  mishear fixes applied to ${fixed} lines`);
}
log(`  ${segs.length} lines, language "${transcript.language}"`);

// ── 3. SECTION MAP ──────────────────────────────────────────────────────────
// The official lyrics (with [Section] headers) are the reference; the LLM pins
// each section to a real transcribed line time.
const official = args["lyrics-file"] && args["lyrics-file"] !== true
  ? readFileSync(resolve(args["lyrics-file"]), "utf8") : "";
log("▶ mapping sections (LLM) …");
const timedLines = segs.map((s) => `${Math.round(s.start)}s: ${s.text}`).join("\n");
const sec = await llm(
  "You map song structure onto transcribed lyrics. Respond with ONLY the requested JSON.",
  `Song: "${TITLE}" by ${ARTIST} (${duration}s).

OFFICIAL LYRICS (with section headers — the structure reference):
${official.slice(0, 4000)}

TRANSCRIBED LYRICS (with start times — the timing truth):
${timedLines}

Return JSON: {"sections": [4-12 sections in order, each {"name": short section name from the official structure ("Intro"|"Verse 1"|"Pre-Chorus"|"Hook"|"Breakdown"|"Outro"…), "start": seconds}]}.
Every start MUST be one of the line start times listed above (the line that begins that section).`,
  1400,
);
const lineTimes = segs.map((s) => s.start);
const snap = (t) => lineTimes.reduce((best, x) => Math.abs(x - t) < Math.abs(best - t) ? x : best, lineTimes[0]);
let sections = (sec.sections || [])
  .map((s) => ({ name: String(s.name || "Section"), start: snap(Number(s.start) || 0) }))
  .sort((a, b) => a.start - b.start)
  .filter((s, i, a) => i === 0 || s.start > a[i - 1].start + 3);
if (!sections.length || sections[0].start > segs[0].start) sections.unshift({ name: "Intro", start: segs[0].start });
log(`  sections: ${sections.map((s) => `${s.name}@${Math.round(s.start)}`).join(", ")}`);

// ── 4. LRC + WORDS ──────────────────────────────────────────────────────────
const lrcLines = [];
let si = 0;
for (const s of segs) {
  while (si < sections.length && sections[si].start <= s.start + 0.01) {
    lrcLines.push(`[${sections[si].name}]`); si++;
  }
  lrcLines.push(toLrc(s.start) + s.text.trim());
}
const lrc = lrcLines.join("\n");
const words = segs.flatMap((s) => s.words?.length
  ? s.words.map((x) => ({ t: x.t, w: x.text }))
  : [{ t: s.start, w: s.text.trim() }]);
writeFileSync(join(wd, "lyrics.lrc"), lrc);
log(`  ${words.length} timed words`);

// ── 5. PLANET ANALYSIS ──────────────────────────────────────────────────────
log("▶ planet analysis (analyze.mjs) …");
writeFileSync(join(wd, "tracks.json"), JSON.stringify([{
  id, title: TITLE, artist: ARTIST, genre: args.genre || "", mood: args.mood || "",
  style: STYLE, lyrics: lrc,
}]));
const an = spawnSync("node", [join(REPO, "scripts/song-analysis/analyze.mjs"),
  "--in", join(wd, "tracks.json"), "--out", join(wd, "planet.json"), "--model", MODEL],
  { stdio: ["ignore", 2, 2] });
if (an.status !== 0) throw new Error("analyze.mjs failed");
const planetOut = JSON.parse(readFileSync(join(wd, "planet.json"), "utf8"))[0];
if (!planetOut.ok) throw new Error("analysis failed: " + planetOut.error);
const planet = planetOut.planet;
if (STYLE) planet.styleHint = STYLE;
const a = planet.analysis;

// ── 6. CHOREOGRAPHY ─────────────────────────────────────────────────────────
log("▶ choreographing touch …");
const secList = a.sections.map((s) => ({ name: s.name, emotion: s.emotion, start: s.start, intensity: s.intensity }));
const TAP = ["burn", "shatter", "dissolve", "bloom"], LAYERS = ["ash", "frost", "steam", "fog", "static"];
const choreo = await llm(
  "You choreograph touch interactions for animated lyric worlds. Respond with ONLY the requested JSON.",
  `Song "${TITLE}" — ${a.summary}
THEMES: ${(a.themes || []).join(", ")} · VISUAL WORLD: ${STYLE || a.overallMood}
SECTIONS: ${JSON.stringify(secList)}

Return JSON:
- "tapEffect": ONE of ${JSON.stringify(TAP)} — what tapping a lyric word does in THIS song's world (burn=fire/defiance, shatter=breakup/impact, dissolve=dreamy/sad, bloom=love/joy).
- "wipes": 1-2 moments where a translucent layer covers the screen and the listener wipes it away. Each {"start": a section start time from above (quiet/atmospheric sections), "layer": one of ${JSON.stringify(LAYERS)}, "prompt": short instruction in the song's voice, max 5 words}.
- "blow": ONE moment where blowing into the microphone fits the lyric (breath, wind, smoke, candles, a wish) — {"start": section start, "prompt": max 5 words} — or null if nothing fits.
- "shake": ONE drop/impact moment worth shaking the phone at — {"start": section start, "prompt": max 5 words} — or null.`,
  900,
);
const secStarts = a.sections.map((s) => s.start);
const snapSec = (t) => secStarts.reduce((b, x) => Math.abs(x - t) < Math.abs(b - t) ? x : b, secStarts[0]);
const moments = [];
const clear = (t) => moments.every((m) => Math.abs(m.t - t) > 22);
for (const w of (choreo.wipes || []).slice(0, 2)) {
  const t = snapSec(Number(w.start) || 0);
  if (clear(t)) moments.push({ t, end: Math.min(t + 16, duration - 2), type: "wipe", layer: LAYERS.includes(w.layer) ? w.layer : "fog", prompt: String(w.prompt || "wipe it away").slice(0, 40) });
}
for (const [key, type, len] of [["blow", "blow", 10], ["shake", "shake", 6]]) {
  const m = choreo[key];
  if (m && m.start != null) {
    const t = snapSec(Number(m.start) || 0);
    if (clear(t)) moments.push({ t, end: Math.min(t + len, duration - 2), type, layer: "", prompt: String(m.prompt || type).slice(0, 40) });
  }
}
planet.interactions = {
  tapEffect: TAP.includes(choreo.tapEffect) ? choreo.tapEffect : "dissolve",
  moments: moments.sort((x, y) => x.t - y.t),
};
log(`  tap=${planet.interactions.tapEffect}, moments: ${moments.map((m) => `${m.type}@${Math.round(m.t)}`).join(", ") || "none"}`);

// ── 7. ART: keywords + section emotions, in the song's own style ───────────
if (!args["skip-art"]) {
  const comfy = args.comfy || "http://localhost:8188";
  const up = await fetch(`${comfy}/system_stats`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
  if (!up) throw new Error("ComfyUI not reachable — rerun with it up, or pass --skip-art");
  const artRoot = join(REPO, "scripts/song-art");
  const pubDir = join(REPO, "public/planets", id);
  mkdirSync(pubDir, { recursive: true });
  const webpName = (w) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const runGen = (planetJson, outDir) => {
    writeFileSync(planetJson.path, JSON.stringify(planetJson.data));
    const g = spawnSync("node", [join(artRoot, "generate.mjs"),
      "--planet", planetJson.path, "--out", outDir, "--song", id, "--host", comfy, "--max", "16"],
      { stdio: ["ignore", 2, 2] });
    if (g.status !== 0) throw new Error("generate.mjs failed for " + outDir);
    return JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
  };
  planet.assets = { keywords: {}, sections: {} };

  log("▶ keyword art …");
  const kwDir = join(artRoot, `${id}-kw`);
  const kwMan = runGen({ path: join(wd, "planet-full.json"), data: planet }, kwDir);
  for (const im of kwMan.images) {
    const name = webpName(im.word);
    await sharp(join(kwDir, im.file)).webp({ quality: 82 }).toFile(join(pubDir, `${name}.webp`));
    planet.assets.keywords[im.word.toLowerCase()] = `/planets/${id}/${name}.webp`;
  }

  log("▶ section-emotion art …");
  const emotions = [...new Set(a.sections.map((s) => s.emotion))];
  const secPlanet = {
    styleHint: planet.styleHint,
    analysis: {
      overallMood: a.overallMood,
      keywords: emotions.map((e) => ({ word: e, emotion: e, imageryPrompt: `abstract scene expressing '${e}'` })),
    },
  };
  const secDir = join(artRoot, `${id}-sec`);
  const secMan = runGen({ path: join(wd, "sec-planet.json"), data: secPlanet }, secDir);
  for (const im of secMan.images) {
    const name = webpName(im.word);
    await sharp(join(secDir, im.file)).webp({ quality: 82 }).toFile(join(pubDir, `${name}.webp`));
    planet.assets.sections[im.word.toLowerCase()] = `/planets/${id}/${name}.webp`;
  }

  // gap-<id>.json feeds variants.mjs its styleHint + prompt fallbacks.
  writeFileSync(join(artRoot, `gap-${id}.json`), JSON.stringify({
    styleHint: planet.styleHint,
    analysis: { keywords: [...kwMan.images, ...secMan.images].map((im) => ({ word: im.word, emotion: im.emotion, imageryPrompt: im.prompt })) },
  }, null, 2));

  log("▶ twins (variants.mjs) …");
  const v = spawnSync("node", [join(artRoot, "variants.mjs"), "--only", id, "--host", comfy], { stdio: ["ignore", 2, 2] });
  if (v.status !== 0) log("  variants failed — twins can be re-run later");
  planet.assets.alt = {};
  for (const f of readdirSync(pubDir)) {
    if (f.endsWith("-2.webp") && existsSync(join(pubDir, f.replace(/-2\.webp$/, ".webp")))) {
      planet.assets.alt[`/planets/${id}/${f.replace(/-2\.webp$/, ".webp")}`] = `/planets/${id}/${f}`;
    }
  }
  log(`  assets: ${Object.keys(planet.assets.keywords).length} kw, ${Object.keys(planet.assets.sections).length} sec, ${Object.keys(planet.assets.alt).length} twins`);
}

// ── 8. PACKAGE ──────────────────────────────────────────────────────────────
planet.generatedAt = new Date().toISOString();
const row = {
  id, title: TITLE, artist: ARTIST,
  genre: args.genre || "", mood: args.mood || "",
  color: (Array.isArray(a.palette) && a.palette[0]) || "#8b7bff",
  cover: args.cover && args.cover !== true ? args.cover : null,
  audio_url: AUDIO_URL,
  sort_order: Number(args.sort ?? 500), featured: false, hidden: false,
  lyrics: lrc, lyrics_synced: { words }, planet,
};
writeFileSync(join(wd, "row.json"), JSON.stringify(row, null, 2));
const q = (v) => v == null ? "NULL" : `$x1c7$${String(v)}$x1c7$`;
const j = (v) => `$x1c7$${JSON.stringify(v)}$x1c7$::jsonb`;
writeFileSync(join(wd, "row.sql"),
  `INSERT INTO tracks (id, title, artist, genre, mood, color, cover, audio_url, sort_order, featured, hidden, lyrics, lyrics_synced, planet)
VALUES (${q(row.id)}, ${q(row.title)}, ${q(row.artist)}, ${q(row.genre)}, ${q(row.mood)}, ${q(row.color)}, ${q(row.cover)}, ${q(row.audio_url)}, ${row.sort_order}, false, false, ${q(row.lyrics)}, ${j(row.lyrics_synced)}, ${j(row.planet)})
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, artist = EXCLUDED.artist, genre = EXCLUDED.genre, mood = EXCLUDED.mood, color = EXCLUDED.color, cover = EXCLUDED.cover, audio_url = EXCLUDED.audio_url, sort_order = EXCLUDED.sort_order, hidden = false, lyrics = EXCLUDED.lyrics, lyrics_synced = EXCLUDED.lyrics_synced, planet = EXCLUDED.planet;\n`);
log(`\n✅ public planet packaged:
   row  → ${join(wd, "row.json")}
   sql  → ${join(wd, "row.sql")}  ← apply via Supabase MCP / SQL editor`);

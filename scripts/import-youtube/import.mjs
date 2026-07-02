#!/usr/bin/env node
// YouTube → private planet importer. PERSONAL USE ONLY: nothing is uploaded or
// redistributed. Audio + cover land in public/private/ (gitignored — served
// only when you run the site locally), and the DB row is hidden=true so the
// public site never lists it. Private planets appear only on localhost.
//
// Pipeline: rip (yt-dlp) → transcribe vocals w/ word timestamps (Whisper +
// demucs) → research song (local LLM: artist/genre/mood/style/sections) →
// planet analysis (analyze.mjs) → touch choreography (tap/wipe/blow/shake) →
// package (files + row.json + row.sql).
//
// Usage:
//   node import.mjs --url "https://www.youtube.com/watch?v=…" --venv /path/to/whisper-venv
//     [--id slug] [--lang es] [--no-demucs] [--workdir ./wd] [--model qwen2.5:14b]
//
// Apply the emitted row.sql via the Supabase MCP / dashboard SQL editor, then
// `npm run dev` and the planet is live in your local galaxy.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const URL_IN = args.url;
const VENV = args.venv || process.env.WHISPER_VENV;
const MODEL = args.model || "qwen2.5:14b";
if (!URL_IN || !VENV) {
  console.error("usage: import.mjs --url <youtube url> --venv <whisper venv> [--id slug] [--lang xx]");
  process.exit(1);
}
const log = (...a) => console.error(...a);
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const toLrc = (sec) => {
  const mm = Math.floor(sec / 60), ss = Math.floor(sec % 60), cs = Math.round((sec % 1) * 100) % 100;
  return `[${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}]`;
};

async function llm(system, user, numPredict = 1200) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: false, format: "json", think: false,
      options: { temperature: 0.4, num_ctx: 8192, num_predict: numPredict },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const raw = (await res.json()).message?.content || "";
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
}

// ── 1. RIP ──────────────────────────────────────────────────────────────────
const wd = resolve(args.workdir || join(HERE, "wd"));
mkdirSync(wd, { recursive: true });
if (!existsSync(join(wd, "audio.mp3"))) {
  log("▶ ripping audio + metadata …");
  execFileSync(join(VENV, "bin/yt-dlp"), [
    "--no-playlist", "--no-write-playlist-metafiles", "-x", "--audio-format", "mp3",
    "--audio-quality", "0", "--write-info-json", "--write-thumbnail",
    "--convert-thumbnails", "jpg", "-o", join(wd, "audio.%(ext)s"), URL_IN,
  ], { stdio: ["ignore", 2, 2] });
} else log("▶ audio.mp3 already ripped — reusing");
let info = JSON.parse(readFileSync(join(wd, "audio.info.json"), "utf8"));
if (info._type === "playlist") info = info.entries?.[0] || info; // ytsearch wrapper
const id = args.id || slug(info.title || "yt-import");
// The mp3 itself is the duration authority (playlist metadata can say 0).
const duration = Math.round(Number(execFileSync("ffprobe", ["-v", "error",
  "-show_entries", "format=duration", "-of", "csv=p=0", join(wd, "audio.mp3")],
  { encoding: "utf8" })) || info.duration || 0);
log(`  "${info.title}" by ${info.uploader || "?"} — ${duration}s → id "${id}"`);

// ── 2. TRANSCRIBE ───────────────────────────────────────────────────────────
const tPath = join(wd, "transcript.json");
if (!existsSync(tPath)) {
  log("▶ transcribing vocals (Whisper large-v3" + (args["no-demucs"] ? "" : " + demucs") + ") …");
  const py = [join(HERE, "transcribe.py"), "--audio", join(wd, "audio.mp3"), "--out", tPath];
  if (args.lang) py.push("--language", args.lang);
  if (args["no-demucs"]) py.push("--no-demucs");
  const r = spawnSync(join(VENV, "bin/python"), py, { stdio: ["ignore", 2, 2] });
  if (r.status !== 0) throw new Error("transcription failed");
}
const transcript = JSON.parse(readFileSync(tPath, "utf8"));
const segs = transcript.segments.filter((s) => s.text.trim());
if (!segs.length) throw new Error("no vocals transcribed — is this an instrumental?");
log(`  ${segs.length} lines, language "${transcript.language}"`);

// ── 3. RESEARCH ─────────────────────────────────────────────────────────────
log("▶ researching song (LLM) …");
const timedLines = segs.map((s) => `${Math.round(s.start)}s: ${s.text}`).join("\n");
const research = await llm(
  "You are a music researcher and art director. Respond with ONLY the requested JSON.",
  `A song ripped from YouTube. Identify and describe it from the metadata + transcribed lyrics.

VIDEO TITLE: ${info.title}
CHANNEL: ${info.uploader || info.channel || "?"}
TAGS: ${(info.tags || []).slice(0, 12).join(", ")}
DESCRIPTION (start): ${String(info.description || "").slice(0, 500)}
DURATION: ${duration}s
TRANSCRIBED LYRICS (with start times):
${timedLines}

Return JSON:
- "title": the song's clean title (strip "(Official Video)" etc)
- "artist": the performing artist
- "genre": short genre label
- "mood": 2-4 word mood
- "language": ISO code of the lyrics
- "style": ONE sentence text-to-image style hint capturing this song's visual world (era, texture, color feel — no artist names)
- "sections": 4-10 song sections in order, each {"name": "Intro"|"Verse 1"|"Chorus"|"Bridge"|"Outro"…, "start": seconds}. Every start MUST be one of the line start times listed above (the line that begins that section).`,
  1600,
);
log(`  → "${research.title}" by ${research.artist} · ${research.genre} · ${research.mood}`);

// Snap section starts to real line times; dedupe + sort.
const lineTimes = segs.map((s) => s.start);
const snap = (t) => lineTimes.reduce((best, x) => Math.abs(x - t) < Math.abs(best - t) ? x : best, lineTimes[0]);
let sections = (research.sections || [])
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
// Engine word shape is {t, w} (see LyricsSynced in src/data/tracks.ts).
const words = segs.flatMap((s) => s.words?.length
  ? s.words.map((x) => ({ t: x.t, w: x.text }))
  : [{ t: s.start, w: s.text.trim() }]);
writeFileSync(join(wd, "lyrics.lrc"), lrc);

// ── 5. PLANET ANALYSIS (existing brain) ─────────────────────────────────────
log("▶ planet analysis (analyze.mjs) …");
writeFileSync(join(wd, "tracks.json"), JSON.stringify([{
  id, title: research.title, artist: research.artist, genre: research.genre,
  mood: research.mood, style: research.style, lyrics: lrc,
}]));
const an = spawnSync("node", [join(REPO, "scripts/song-analysis/analyze.mjs"),
  "--in", join(wd, "tracks.json"), "--out", join(wd, "planet.json"), "--model", MODEL],
  { stdio: ["ignore", 2, 2] });
if (an.status !== 0) throw new Error("analyze.mjs failed");
const planetOut = JSON.parse(readFileSync(join(wd, "planet.json"), "utf8"))[0];
if (!planetOut.ok) throw new Error("analysis failed: " + planetOut.error);
const planet = planetOut.planet;
planet.styleHint = research.style;

// ── 6. CHOREOGRAPHY (tap / wipe / blow / shake) ─────────────────────────────
log("▶ choreographing touch …");
const a = planet.analysis;
const secList = a.sections.map((s) => ({ name: s.name, emotion: s.emotion, start: s.start, intensity: s.intensity }));
const TAP = ["burn", "shatter", "dissolve", "bloom"], LAYERS = ["ash", "frost", "steam", "fog", "static"];

const choreo = await llm(
  "You choreograph touch interactions for animated lyric worlds. Respond with ONLY the requested JSON.",
  `Song "${research.title}" — ${a.summary}
THEMES: ${(a.themes || []).join(", ")} · VISUAL WORLD: ${research.style}
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

// ── 7. ART (optional — needs ComfyUI running) ──────────────────────────────
const pub = join(REPO, "public/private");
mkdirSync(pub, { recursive: true });
if (args.art) {
  const comfy = args.comfy || "http://localhost:8188";
  const up = await fetch(`${comfy}/system_stats`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
  if (up) {
    log("▶ generating keyword art (ComfyUI) …");
    writeFileSync(join(wd, "planet-full.json"), JSON.stringify(planet));
    const artDir = join(pub, `${id}-art`);
    const g = spawnSync("node", [join(REPO, "scripts/song-art/generate.mjs"),
      "--planet", join(wd, "planet-full.json"), "--out", artDir, "--song", id, "--host", comfy],
      { stdio: ["ignore", 2, 2] });
    const manifestPath = join(artDir, "manifest.json");
    if (g.status === 0 && existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      planet.assets = planet.assets || {};
      planet.assets.keywords = Object.fromEntries(
        (manifest.images || []).map((im) => [im.word, `/private/${id}-art/${im.file}`]));
      log(`  ${manifest.images?.length || 0} keyword images → public/private/${id}-art/`);
    } else log("  art generation failed — continuing without assets");
  } else log("▶ ComfyUI not reachable — skipping art (rerun with ComfyUI up + --art)");
}

// ── 8. PACKAGE ──────────────────────────────────────────────────────────────
log("▶ packaging private planet …");
copyFileSync(join(wd, "audio.mp3"), join(pub, `${id}.mp3`));
const hasCover = existsSync(join(wd, "audio.jpg"));
if (hasCover) copyFileSync(join(wd, "audio.jpg"), join(pub, `${id}.jpg`));

planet.generatedAt = new Date().toISOString();
planet.source = "youtube-private";
const row = {
  id, title: research.title, artist: research.artist, genre: research.genre,
  mood: research.mood,
  color: a.palette?.primary || (Array.isArray(a.palette) && a.palette[0]) || "#8b7bff",
  cover: hasCover ? `/private/${id}.jpg` : null,
  audio_url: `/private/${id}.mp3`,
  sort_order: 500, featured: false, hidden: true,
  lyrics: lrc, lyrics_synced: { words }, planet,
};
writeFileSync(join(wd, "row.json"), JSON.stringify(row, null, 2));

const q = (v) => v == null ? "NULL" : `$x1c7$${String(v)}$x1c7$`;
const j = (v) => `$x1c7$${JSON.stringify(v)}$x1c7$::jsonb`;
writeFileSync(join(wd, "row.sql"),
  `INSERT INTO tracks (id, title, artist, genre, mood, color, cover, audio_url, sort_order, featured, hidden, lyrics, lyrics_synced, planet)
VALUES (${q(row.id)}, ${q(row.title)}, ${q(row.artist)}, ${q(row.genre)}, ${q(row.mood)}, ${q(row.color)}, ${q(row.cover)}, ${q(row.audio_url)}, 500, false, true, ${q(row.lyrics)}, ${j(row.lyrics_synced)}, ${j(row.planet)})
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, artist = EXCLUDED.artist, genre = EXCLUDED.genre, mood = EXCLUDED.mood, color = EXCLUDED.color, cover = EXCLUDED.cover, audio_url = EXCLUDED.audio_url, hidden = true, lyrics = EXCLUDED.lyrics, lyrics_synced = EXCLUDED.lyrics_synced, planet = EXCLUDED.planet;\n`);

log(`\n✅ private planet packaged:
   audio  → public/private/${id}.mp3 (gitignored, localhost-only)
   row    → ${join(wd, "row.json")}
   sql    → ${join(wd, "row.sql")}  ← apply via Supabase MCP / SQL editor
   then:  npm run dev → http://localhost:3000/galaxy (private planets appear locally)`);

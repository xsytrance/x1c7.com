#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ULTIMATE ANALYZER — one tool, three depths.
//
// Feed it whatever exists and it uses everything present:
//   stems only          → identity guess (title/genre/style/bpm/key) + lyrics
//                         transcript + full measured senses
//   mp3/wav only        → same, senses approximated via demucs 4-stem split
//   everything          → (mix + stems zip + cover + lyrics + style) deep
//                         analysis → the ultimate song profile
//
// The profile is emitted in the exact dialects the engines already eat:
//   <id>-planet-full.json  → lexicon/harvest.mjs + KineticStage full shows
//   senses.json (StemData) → stem senses in x1c7 AND Kinetica (v:1 dialect)
//   profile.json           → everything above + identity, cover read,
//                            energy arc, drop map, show hints
//
//   node scripts/song-analysis/ultimate.mjs \
//     [--audio song.mp3] [--stems <dir|zip>] [--cover art.png] \
//     [--lyrics-file lyrics.txt] [--style "hint or file.txt"] \
//     [--id slug] [--title "..."] [--artist xsytrance] \
//     [--out scripts/song-analysis/profiles/<id>] \
//     [--model qwen3.5:latest] [--vision-model llama3.2-vision] \
//     [--venv ~/whisper-venv] [--skip-vision] [--no-demucs] [--lang en] \
//     [--publish]   (ship profile.json → R2 planets/<id>/ for the SONIC DOSSIER)
//
// Needs at least one of --audio / --stems. DSP runs in the stem-analysis
// venv (librosa); transcription in the whisper venv; LLM via Ollama.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import http from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";
const DSP_PY = join(REPO, "scripts", "stem-analysis", ".venv", "bin", "python");

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const log = (...a) => console.error(...a);
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ── SUNO SELF-SERVE ─────────────────────────────────────────────────────────
// --suno <uuid | suno.com/song url | slug | title fragment> pulls whatever
// inputs weren't given manually from the public profile API: release mp3,
// cover, official lyrics (metadata.prompt), style (metadata.tags), title.
let suno = null;
if (args.suno && args.suno !== true) {
  const handle = args.handle && args.handle !== true ? args.handle : "xsytrance";
  const key = String(args.suno).replace(/^https?:\/\/suno\.com\/song\//, "").replace(/[?#].*$/, "").toLowerCase();
  const UA = { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" } };
  const clips = [];
  for (let n = 1; ; n++) {
    const res = await fetch(`https://studio-api.prod.suno.com/api/profiles/${handle}?playlists_sort_by=upvote_count&clips_sort_by=created_at&page=${n}`, UA);
    if (!res.ok) throw new Error(`suno api ${res.status}`);
    const p = await res.json();
    clips.push(...(p.clips ?? []));
    if (!p.clips?.length || clips.length >= (p.num_total_clips ?? 0)) break;
  }
  // norm strips everything but [a-z0-9] — survives "&&", accents, CJK
  // prefixes, and "xsytrance Presents:" title dressing.
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "");
  const c = clips.find((x) => x.id === key)
    ?? clips.find((x) => slugify(x.title ?? "") === key)
    ?? clips.find((x) => (x.title ?? "").toLowerCase().includes(key))
    ?? clips.find((x) => norm(x.title) === norm(key))
    ?? clips.find((x) => norm(x.title).includes(norm(key)) || norm(key).includes(norm(x.title)));
  if (!c) { console.error(`✗ no public clip matching "${args.suno}" on @${handle}`); process.exit(1); }
  suno = {
    id: c.id, title: c.title?.trim(), tags: c.metadata?.tags ?? null,
    lyrics: c.metadata?.prompt ?? null, audioUrl: c.audio_url, imageUrl: c.image_large_url ?? c.image_url,
  };
  log(`suno: "${suno.title}" (${suno.id})`);
}

const STEMS_IN = args.stems && args.stems !== true ? resolve(args.stems) : null;
if (!args.audio && !STEMS_IN && !suno) { console.error("need --audio, --stems, or --suno"); process.exit(1); }
const TITLE = args.title && args.title !== true ? args.title : suno?.title ?? null;
const ARTIST = args.artist && args.artist !== true ? args.artist : "xsytrance";
const ID = args.id && args.id !== true ? args.id
  : slugify((TITLE || basename(STEMS_IN || args.audio)).replace(/\.[a-z0-9]+$/, "").replace(/stems?$/i, ""));
const OUT = resolve(args.out && args.out !== true ? args.out : join(HERE, "profiles", ID));
const MODEL = args.model && args.model !== true ? args.model : "qwen3.5:latest";
const VISION = args["vision-model"] && args["vision-model"] !== true ? args["vision-model"] : "llama3.2-vision";
const VENV = args.venv && args.venv !== true ? resolve(args.venv) : `${process.env.HOME}/whisper-venv`;
mkdirSync(OUT, { recursive: true });

const fetchTo = async (url, dest) => {
  if (existsSync(dest)) return dest;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
};
let AUDIO = args.audio && args.audio !== true ? resolve(args.audio) : null;
if (!AUDIO && suno?.audioUrl) { log("↓ suno release mp3 …"); AUDIO = await fetchTo(suno.audioUrl, join(OUT, "release.mp3")); }
let COVER = args.cover && args.cover !== true ? resolve(args.cover) : null;
if (!COVER && suno?.imageUrl) COVER = await fetchTo(suno.imageUrl, join(OUT, "cover.jpeg"));
const LYRICS = args["lyrics-file"] && args["lyrics-file"] !== true
  ? readFileSync(resolve(args["lyrics-file"]), "utf8").trim() : suno?.lyrics?.trim() ?? null;
const STYLE = args.style && args.style !== true
  ? (existsSync(resolve(args.style)) ? readFileSync(resolve(args.style), "utf8").trim() : args.style)
  : suno?.tags?.trim() ?? null;

// Same filename → bucket map as analyze_stems.py / publish-stems.mjs.
const PATTERNS = [
  ["lead", "lead voc"], ["back", "backing voc"], ["drums", "drum"], ["bass", "bass"],
  ["perc", "perc"], ["synth", "synth"], ["other", "other"], ["guitar", "guitar"], ["keys", "keyboard"],
  ["strings", "strings"], ["woodwinds", "woodwind"], ["brass", "brass"],
];

async function llm(system, user, numPredict = 1600, model = MODEL, images = null) {
  // node:http, not fetch — fetch's undici enforces a 300s headers timeout,
  // and on a long prompt Ollama's prompt eval can exceed that before the
  // first streamed byte arrives, even with stream:true.
  const msg = { role: "user", content: user };
  if (images) msg.images = images;
  const body = JSON.stringify({
    model, stream: true, format: "json", think: false,
    options: { temperature: 0.4, num_ctx: 8192, num_predict: numPredict },
    messages: [{ role: "system", content: system }, msg],
  });
  const text = await new Promise((resolve, reject) => {
    const req = http.request(`${OLLAMA}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`LLM ${res.statusCode}`)); res.resume(); return; }
      let out = "", buf = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buf += chunk;
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try { out += JSON.parse(line).message?.content ?? ""; } catch { /* partial line */ }
        }
      });
      res.on("end", () => resolve(out));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error(`LLM returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(a, b + 1));
}

const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { stdio: ["ignore", "pipe", "inherit"], ...opts });
const fmtT = (s) => `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.round((s % 1) * 100) % 100).padStart(2, "0")}]`;

// ── 1. GATHER ───────────────────────────────────────────────────────────────
let stemsDir = null;
if (STEMS_IN) {
  if (STEMS_IN.endsWith(".zip")) {
    stemsDir = join(OUT, "stems-src");
    mkdirSync(stemsDir, { recursive: true });
    run("unzip", ["-o", "-q", STEMS_IN, "-d", stemsDir]);
  } else stemsDir = STEMS_IN;
}
const stemFiles = {};
if (stemsDir) {
  for (const f of readdirSync(stemsDir).sort()) {
    const low = f.toLowerCase();
    if (!/\.(mp3|wav|flac)$/.test(low)) continue;
    for (const [key, pat] of PATTERNS) if (low.includes(pat)) stemFiles[key] = join(stemsDir, f);
  }
  log(`stems: ${Object.keys(stemFiles).join(", ") || "none recognized"}`);
}
const mode = stemsDir && AUDIO ? "full" : stemsDir ? "stems-only" : "audio-only";
log(`mode: ${mode}  id: ${ID}`);

// Release clock: the real mix, or a proxy summed from the stems.
let release = AUDIO;
if (!release) {
  release = join(OUT, "release-proxy.mp3");
  if (!existsSync(release)) {
    const srcs = Object.values(stemFiles);
    log(`▶ mixing ${srcs.length}-stem release proxy …`);
    run("ffmpeg", ["-y", "-v", "error", ...srcs.flatMap((f) => ["-i", f]),
      "-filter_complex", `amix=inputs=${srcs.length}:duration=longest:normalize=0`,
      "-c:a", "libmp3lame", "-q:a", "4", release]);
  }
}

// ── 2. MEASURE (DSP) ────────────────────────────────────────────────────────
const sensesPath = join(OUT, "senses.json");
if (!existsSync(sensesPath)) {
  if (stemsDir) {
    log("▶ analyze_stems.py (measured senses) …");
    run(DSP_PY, [join(REPO, "scripts/stem-analysis/analyze_stems.py"),
      "--stems", stemsDir, "--release", release, "--out", sensesPath]);
  } else {
    log(`▶ analyze_audio.py (approx senses${args["no-demucs"] ? ", HPSS" : ", demucs"}) …`);
    run(DSP_PY, [join(REPO, "scripts/stem-analysis/analyze_audio.py"),
      "--audio", release, "--out", sensesPath, ...(args["no-demucs"] ? ["--no-demucs"] : [])]);
  }
}
const senses = JSON.parse(readFileSync(sensesPath, "utf8"));

// Mix-level features (key/boundaries/brightness) even when stems exist.
const mixPath = join(OUT, "mix-features.json");
if (!senses.mix && !existsSync(mixPath)) {
  log("▶ analyze_audio.py --features-only (key + structure) …");
  run(DSP_PY, [join(REPO, "scripts/stem-analysis/analyze_audio.py"),
    "--audio", release, "--out", mixPath, "--features-only", "--no-demucs"]);
}
const mix = senses.mix ?? JSON.parse(readFileSync(mixPath, "utf8")).mix;

// ── 3. HEAR THE WORDS (Whisper) ─────────────────────────────────────────────
const trPath = join(OUT, "transcript.json");
// The lead stem is the fast path (isolated vocal, no demucs) — but it lives
// on the STEM clock. With a real release and a weak alignment score the two
// clocks can genuinely diverge (different cut/master), so timestamps would
// drift; then the release itself is the only trustworthy clock.
const stemClockOk = !AUDIO || (senses.align?.score ?? 0) >= 0.6;
const useLead = !!stemFiles.lead && stemClockOk;
if (!existsSync(trPath)) {
  const src = useLead ? stemFiles.lead : release;
  log(`▶ transcribe ${basename(src)} ${useLead ? "(isolated lead, no demucs)" : "(release + demucs — stem clock unreliable)"} …`);
  run(`${VENV}/bin/python`, [join(REPO, "scripts/import-youtube/transcribe.py"),
    "--audio", src, "--out", trPath,
    ...(useLead ? ["--no-demucs"] : []),
    ...(args.lang && args.lang !== true ? ["--language", args.lang] : [])]);
}
const transcript = JSON.parse(readFileSync(trPath, "utf8"));
// Stem clock → release clock.
const lag = useLead ? (senses.align?.lag ?? 0) : 0;
const lines = transcript.segments
  .map((s) => ({ t: Math.max(0, s.start + lag), text: s.text.trim() }))
  .filter((l) => l.text);
const lyricsText = LYRICS || lines.map((l) => l.text).join("\n");

// ── 4. IDENTITY ─────────────────────────────────────────────────────────────
const env = senses.env ?? {};
const instruments = Object.keys(env);
const arc = (() => {
  let tot = instruments.length
    ? env[instruments[0]].map((_, i) => instruments.reduce((s, k) => s + (env[k][i] ?? 0), 0) / instruments.length)
    : [];
  // Stems often carry a silent padded tail past the release's end — trim it
  // so the arc reads the song, not the padding.
  let end = tot.length;
  while (end > 0 && tot[end - 1] <= 2) end--;
  tot = tot.slice(0, end);
  if (!tot.length) return null;
  const third = Math.floor(tot.length / 3);
  const avg = (a) => Math.round(a.reduce((s, v) => s + v, 0) / (a.length || 1));
  return { open: avg(tot.slice(0, third)), mid: avg(tot.slice(third, 2 * third)), close: avg(tot.slice(2 * third)) };
})();
const measuredBrief = [
  `bpm ${senses.bpm ?? "?"}`, `duration ${Math.round(senses.duration)}s`,
  `key ${mix?.keyEstimate ? `${mix.keyEstimate.key} ${mix.keyEstimate.mode}` : "?"}`,
  `instruments: ${instruments.join(", ") || "unknown"}`,
  arc ? `energy arc open/mid/close: ${arc.open}/${arc.mid}/${arc.close} (0-99)` : "",
  `beat-cuts ${senses.cuts?.length ?? 0}, risers ${senses.risers?.length ?? 0}`,
  mix ? `brightness ${mix.brightness}Hz, dynamics ${mix.dynamicsDb}dB` : "",
].filter(Boolean).join(" · ");

log("▶ identity (LLM) …");
let identity = await llm(
  `You are a music A&R analyst. From measured audio features and transcribed lyrics, identify the song's character. Respond ONLY with JSON: {"title": string (${TITLE ? "use the given title verbatim" : "invent the most likely title, usually the hook line"}), "titleAlternates": string[] (${TITLE ? "[]" : "2-3 other plausible titles"}), "genre": string (one main genre), "subGenres": string[], "mood": string (2-4 evocative words), "styleSentence": string (one sentence a music producer would write to describe the sound, mentioning tempo/instrumentation/vibe), "language": string, "energy": "low"|"medium"|"high", "vocalStyle": string}`,
  [TITLE ? `Title: ${TITLE}` : null, STYLE ? `Producer style notes: ${STYLE}` : null,
   `Measured: ${measuredBrief}`, `Lyrics:\n${lyricsText.slice(0, 1800)}`].filter(Boolean).join("\n\n"));
// Some models trim optional-feeling fields — one insistent retry fills them.
if (!identity.styleSentence || !identity.energy || !identity.vocalStyle) {
  log("  identity incomplete, one retry …");
  try {
    const again = await llm(
      `Fill in ONLY the missing fields for this song. Respond ONLY with JSON: {"styleSentence": string (one sentence a music producer would write describing the sound: tempo, instrumentation, vibe), "energy": "low"|"medium"|"high", "vocalStyle": string (how the vocal is delivered), "language": string}`,
      [`Known: ${JSON.stringify(identity)}`, `Measured: ${measuredBrief}`, `Lyrics:\n${lyricsText.slice(0, 1200)}`].join("\n\n"));
    identity = { ...again, ...Object.fromEntries(Object.entries(identity).filter(([, v]) => v != null && v !== "")) };
  } catch (e) { log("  retry failed (non-fatal):", e.message); }
}
if (TITLE) identity.title = TITLE;
log(`  "${identity.title}" — ${identity.genre} · ${identity.mood}`);

// ── 5. READ THE COVER ───────────────────────────────────────────────────────
// Palette is pure code and always runs; only the vision-LLM read is skippable
// (--skip-vision also avoids the model swap that can wedge Ollama's scheduler).
let cover = null;
if (COVER) {
  log(`▶ cover (palette${args["skip-vision"] ? "" : " + vision"}) …`);
  const { default: sharp } = await import("sharp");
  const buf = readFileSync(COVER);
  const { data, info } = await sharp(buf).resize(64, 64, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const k = `${data[i] >> 4}.${data[i + 1] >> 4}.${data[i + 2] >> 4}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const palette = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k]) => "#" + k.split(".").map((v) => ((+v << 4) | 8).toString(16).padStart(2, "0")).join(""));
  let read = {};
  if (!args["skip-vision"]) {
    try {
      read = await llm(
        'Describe this album cover for a stage-visuals designer. Respond ONLY with JSON: {"description": string (2 sentences), "mood": string, "artStyle": string, "subjects": string[]}',
        "The album cover image is attached.", 600, VISION,
        [(await sharp(buf).resize(672, 672, { fit: "inside" }).jpeg().toBuffer()).toString("base64")]);
    } catch (e) { log("  vision failed (non-fatal):", e.message); }
  }
  cover = { file: COVER, palette, ...read };
}

// ── 6. SECTION MAP → LRC ────────────────────────────────────────────────────
log("▶ section map (LLM) …");
const timed = lines.map((l) => `${fmtT(l.t)} ${l.text}`).join("\n");
const secIn = [
  LYRICS ? `OFFICIAL LYRICS (structure reference):\n${LYRICS.slice(0, 2400)}` : null,
  mix?.boundaries?.length ? `Measured structural boundaries (s): ${mix.boundaries.join(", ")}` : null,
  `TIMED TRANSCRIPT:\n${timed}`,
].filter(Boolean).join("\n\n");
let sections = [];
try {
  const sm = await llm(
    `Split this song into sections (Intro, Verse 1, Chorus, Bridge, Drop, Outro …). The song runs 0 to ${Math.round(senses.duration)}s and the FIRST section starts at or near 0. Use the timed transcript for timings; official lyrics and measured boundaries are structure hints. Respond ONLY with JSON: {"sections":[{"name":string,"start":number(seconds)}]} in ascending start order covering the whole song.`,
    secIn, 900);
  sections = (sm.sections ?? []).filter((s) => typeof s.start === "number")
    .map((s) => ({ name: String(s.name), start: lines.reduce((b, l) => Math.abs(l.t - s.start) < Math.abs(b - s.start) ? l.t : b, s.start) }))
    .sort((a, b) => a.start - b.start);
} catch (e) { log("  section map failed, positional fallback:", e.message); }
if (!sections.length) sections = [{ name: "Song", start: 0 }];
if (sections[0].start > 10) sections[0] = { ...sections[0], start: lines[0]?.t ?? 0 };
let lrc = "", si = 0;
for (const l of lines) {
  while (si < sections.length && l.t >= sections[si].start - 0.01) { lrc += `[${sections[si].name}]\n`; si++; }
  lrc += `${fmtT(l.t)} ${l.text}\n`;
}
writeFileSync(join(OUT, "lyrics.lrc"), lrc);

// ── 7. PLANET ANALYSIS (deep) ───────────────────────────────────────────────
log("▶ planet analysis (analyze.mjs) …");
const tracksJson = join(OUT, "tracks.json");
writeFileSync(tracksJson, JSON.stringify([{
  id: ID, title: identity.title, artist: ARTIST, genre: identity.genre,
  mood: identity.mood, style: STYLE || identity.styleSentence, lyrics: lrc,
}]));
const planetJson = join(OUT, "planet.json");
run("node", [join(HERE, "analyze.mjs"), "--in", tracksJson, "--out", planetJson, "--model", MODEL], { stdio: "inherit" });
const planetRow = JSON.parse(readFileSync(planetJson, "utf8"))[0];
if (!planetRow?.ok) throw new Error(`analyze.mjs failed: ${planetRow?.error}`);
const analysis = planetRow.planet.analysis;

// Lexicon wants single words — when the LLM emits a phrase ("say it with
// your body"), keep its most salient word; drop dupes that creates.
const STOP = new Set(["the", "a", "an", "with", "your", "our", "my", "it", "its", "in", "on", "of", "to", "and", "me", "you", "say"]);
const seenKw = new Set();
const toSingleWord = (k) => {
  let w = String(k.word ?? "").toLowerCase().trim();
  if (w.includes(" ")) w = w.split(/\s+/).filter((x) => !STOP.has(x)).sort((a, b) => b.length - a.length)[0] ?? w.split(/\s+/)[0];
  return { ...k, word: w };
};
analysis.keywords = (analysis.keywords ?? []).map(toSingleWord)
  .filter((k) => k.word && !seenKw.has(k.word) && seenKw.add(k.word));

// ── 7b. THE MEANING PASS ────────────────────────────────────────────────────
// What is this song ABOUT? One deep read over the full lyrics: the story, a
// per-section interpretation with its key line, and an extended brief of
// 12–20 HEAVY keywords (concrete, emotionally loaded, actually sung) so the
// lexicon gets a song's true visual vocabulary instead of six guesses.
// Rides inside analysis → lands in planet-full + profile.json unchanged.
if (!args["no-meaning"]) {
  log("▶ meaning (LLM) …");
  try {
    const sectionNames = (analysis.sections ?? []).map((s) => s.name);
    const meaning = await llm(
      "You are a song interpreter with a painter's eye. Given a song's lyrics and metadata, respond ONLY with JSON: " +
      '{"story":"2-4 sentences: what the song is really about — subtext included",' +
      '"sections":[{"name":"<section>","interpretation":"one sentence","keyLine":"the most loaded lyric line in it"}],' +
      '"keyLines":["3-6 lines that carry the whole song"],' +
      '"extendedKeywords":[{"word":"single concrete sung word","emotion":"...","imageryPrompt":"a vivid text-to-image prompt grounded in THIS song\'s world","weight":0.9}]}. ' +
      "extendedKeywords: 12 to 20 entries. Only words with real weight — emotionally loaded, paintable nouns/verbs that are actually sung (fire, soul, drip, chains). NEVER articles, fillers, or abstract glue words (every, thing, really). weight = how central the word is to this song, 0..1.",
      `Title: ${identity.title}\nGenre: ${identity.genre} · Mood: ${identity.mood}\nSummary so far: ${analysis.summary ?? ""}\nSections: ${sectionNames.join(", ")}\n\nFULL LYRICS:\n${lyricsText}`,
      2600,
    );
    const extended = (Array.isArray(meaning.extendedKeywords) ? meaning.extendedKeywords : [])
      .map(toSingleWord)
      .filter((k) => k.word && k.word.length >= 2 && typeof k.imageryPrompt === "string");
    for (const k of extended) {
      if (seenKw.has(k.word)) continue;
      seenKw.add(k.word);
      analysis.keywords.push({ word: k.word, emotion: k.emotion, imageryPrompt: k.imageryPrompt });
    }
    analysis.meaning = {
      story: String(meaning.story ?? ""),
      sections: Array.isArray(meaning.sections) ? meaning.sections : [],
      keyLines: Array.isArray(meaning.keyLines) ? meaning.keyLines : [],
      extendedKeywords: extended,
    };
    log(`  story: ${analysis.meaning.story.slice(0, 110)}…`);
    log(`  keywords now ${analysis.keywords.length} (extended +${extended.length})`);
  } catch (e) { log("  meaning pass failed (profile still valid):", e.message); }
}

// Measured intensity beats guessed intensity: mean full-band energy per section.
const ENV_HZ = senses.envHz ?? 12.5;
const total = instruments.length
  ? env[instruments[0]].map((_, i) => instruments.reduce((s, k) => s + (env[k][i] ?? 0), 0) / instruments.length) : null;
if (total && analysis.sections?.length) {
  const bounds = analysis.sections.map((s, i) => [s.start ?? 0, analysis.sections[i + 1]?.start ?? senses.duration]);
  const means = bounds.map(([a, b]) => {
    const seg = total.slice(Math.floor(a * ENV_HZ), Math.max(Math.floor(a * ENV_HZ) + 1, Math.floor(b * ENV_HZ)));
    return seg.reduce((s, v) => s + v, 0) / seg.length;
  });
  const lo = Math.min(...means), hi = Math.max(...means);
  analysis.sections.forEach((s, i) => {
    const measured = hi > lo ? (means[i] - lo) / (hi - lo) : 0.5;
    s.intensity = Math.round((0.3 * (s.intensity ?? 0.5) + 0.7 * measured) * 100) / 100;
  });
}

// ── 8. SHOW DOSSIER ─────────────────────────────────────────────────────────
const lead = env.lead ?? null;
const show = {
  energyArc: arc,
  sectionEnergy: analysis.sections?.map((s) => ({ name: s.name, start: s.start, intensity: s.intensity })),
  vocalPresence: lead && analysis.sections?.length
    ? analysis.sections.map((s, i) => {
        const a = Math.floor((s.start ?? 0) * ENV_HZ), b = Math.floor((analysis.sections[i + 1]?.start ?? senses.duration) * ENV_HZ);
        const seg = lead.slice(a, Math.max(a + 1, b));
        return { name: s.name, presence: Math.round(seg.reduce((x, v) => x + v, 0) / seg.length) };
      }) : null,
  dropMap: {
    cuts: senses.cuts ?? [], risers: senses.risers ?? [],
    hint: "cuts → blackout/cut-mode moments; risers → supernova build-ups (stemSense activeCut/activeRiser fire these automatically)",
  },
  performs: { stems: instruments, approx: !!senses.approx },
};

// ── 9. PROFILE ──────────────────────────────────────────────────────────────
const generatedAt = new Date().toISOString();
const styleHint = STYLE || identity.styleSentence;
// harvest.mjs-ready planet (lexicon reads analysis.keywords/palette/overallMood)
writeFileSync(join(OUT, `${ID}-planet-full.json`),
  JSON.stringify({ analysis, styleHint, assets: {}, generatedAt }, null, 2));
const profile = {
  v: 1, mode, id: ID, generatedAt,
  measured: { bpm: senses.bpm ?? null, duration: senses.duration ?? null },
  identity, cover, mixFeatures: mix,
  lyrics: { official: !!LYRICS, language: transcript.language ?? identity.language, text: lyricsText, lrc },
  analysis, show,
  files: {
    senses: "senses.json", planetFull: `${ID}-planet-full.json`, lrc: "lyrics.lrc",
    transcript: "transcript.json", ...(release !== AUDIO ? { releaseProxy: basename(release) } : {}),
  },
  next: [
    "lexicon: node scripts/lexicon/harvest.mjs (reads the planet-full.json), then dream + publish",
    "stems live: node scripts/stem-analysis/publish-stems.mjs --stems <dir> --slug <id> --stems-json <out>/senses.json",
    "full show: merge analysis+interactions into tracks.planet; lyrics_synced from transcript words",
  ],
};
writeFileSync(join(OUT, "profile.json"), JSON.stringify(profile, null, 2));

// --publish → ship profile.json to R2 planets/<id>/profile.json; the /t/<id>
// share page's SONIC DOSSIER picks it up with zero code changes.
if (args.publish) {
  const envFile = join(REPO, ".env");
  const eo = Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
  execFileSync("rclone", ["copyto", join(OUT, "profile.json"), `R2:${eo.BUCKET || "x1c7-music"}/planets/${ID}/profile.json`, "--s3-no-check-bucket", "--no-traverse"], {
    env: {
      ...process.env,
      RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: eo.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: eo.SECRET_ACCESS_KEY,
      RCLONE_CONFIG_R2_ENDPOINT: eo.ENDPOINT,
    }, stdio: "inherit",
  });
  log(`↑ published → planets/${ID}/profile.json`);
}

console.log(JSON.stringify({
  id: ID, mode, title: identity.title, genre: identity.genre, mood: identity.mood,
  bpm: senses.bpm, key: mix?.keyEstimate, sections: analysis.sections?.length,
  keywords: analysis.keywords?.length, out: OUT,
}, null, 2));
log(`\n✦ ultimate profile → ${join(OUT, "profile.json")}`);

#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CURATOR · SHOW AUDIT — the machine watches its own shows.
//
// For every image in a song's lexicon-reel: fetch the actual pixels and ask
// the VLM (qwen3-vl) to re-read them IN THE SONG'S CONTEXT — does this image
// belong in this song's world (songFit), does it express its word (wordMatch),
// is the render clean (quality)? Timing is checked locally: the reel's `t`
// must sit on a sung occurrence of the word in aligned.json.
//
// Every verdict is journaled to audit-journal.jsonl. Fresh readings replace
// the cached ones in vision-index.json (+ embeddings), so the next match-reel
// rebuild judges from what the image ACTUALLY shows. With --apply, images
// below the floor (quality < 0.45 or wordMatch < 0.35) are pruned: journaled
// to prune-journal.jsonl, deleted from R2, removed from sense.images, and the
// slot's reroll counter bumped so the Atelier repaints it differently — the
// word lands in .audit-regen.txt as the generate list.
//
//   node scripts/curator/show-audit.mjs --song i-won-t-be-your-fire        # document only
//   node scripts/curator/show-audit.mjs --songs a,b,c --apply
//   node scripts/curator/show-audit.mjs --all --apply --fresh-hours 20
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readingText } from "./vision-worker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const INDEX = path.join(__dirname, "vision-index.json");
const EMB = path.join(__dirname, ".cache", "embeddings.jsonl");
const PROFILES = path.join(ROOT, "scripts", "song-analysis", "profiles");
const AUDIT_JOURNAL = path.join(__dirname, "audit-journal.jsonl");
const PRUNE_JOURNAL = path.join(__dirname, "prune-journal.jsonl");
const REGEN = path.join(__dirname, ".audit-regen.txt");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const APPLY = !!args.apply;
const MODEL = args.model && args.model !== true ? args.model : "qwen3-vl:8b";
const EMB_MODEL = "qwen3-embedding:0.6b";
const FRESH_H = args["fresh-hours"] ? parseFloat(args["fresh-hours"]) : 20;
const Q_MIN = args["q-min"] ? parseFloat(args["q-min"]) : 0.45;
const WM_MIN = args["wm-min"] ? parseFloat(args["wm-min"]) : 0.35;
const FIT_LOW = 0.45; // below this the image is a misfit for THIS show (documented; reel rebuild decides)
const T_TOL = 4.0;    // seconds — reel `t` must sit this close to a sung occurrence
const log = (...a) => console.error(...a);

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const E = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
const RCLONE = fs.existsSync(`${process.env.HOME}/.local/bin/rclone`) ? `${process.env.HOME}/.local/bin/rclone` : "rclone";
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};

const norm = (w) => (w || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

const AUDIT_SYS =
  "You examine one AI-generated artwork that plays during a specific SONG's visual show, timed to a specific LYRIC LINE and WORD. " +
  "Respond ONLY with JSON keys: " +
  "caption (one vivid sentence), subjects (array of concrete things shown), setting (where/when), mood (array of feelings), " +
  "palette (array of 2-4 hex colors that dominate), style (art style in a few words), symbols (array: what the image evokes/means), " +
  "textInImage (exact visible text, empty string if none), " +
  "quality (0..1: render quality — artifacts, garbled anatomy or gibberish text lower it), " +
  "wordMatch (0..1: how well the image expresses its WORD), " +
  "songFit (0..1: does this image belong in THIS song's world — subject, mood, symbolism, judged against the song's story/themes/mood and the lyric line), " +
  "issues (array of short strings naming concrete problems, empty if none).";

async function vlmAudit(jpgB64, song, entry) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: false, format: "json", think: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 700 },
      messages: [
        { role: "system", content: AUDIT_SYS },
        { role: "user", content: `SONG: ${song.title}\nStory: ${song.story}\nThemes: ${song.themes}\nMood: ${song.mood}\n\nWORD this image was painted for: "${entry.word}"\nLYRIC LINE it appears on: "${entry.line}"`, images: [jpgB64] },
      ],
    }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const msg = (await r.json()).message ?? {};
  // this ollama build sometimes routes qwen3-vl's JSON into `thinking`
  const raw = (msg.content || "").trim() || (msg.thinking || "").trim();
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON in VLM reply");
  const j = JSON.parse(raw.slice(a, b + 1));
  return {
    caption: String(j.caption ?? ""),
    subjects: Array.isArray(j.subjects) ? j.subjects.map(String).slice(0, 8) : [],
    setting: String(j.setting ?? ""),
    mood: Array.isArray(j.mood) ? j.mood.map(String).slice(0, 6) : [],
    palette: Array.isArray(j.palette) ? j.palette.map(String).slice(0, 4) : [],
    style: String(j.style ?? ""),
    symbols: Array.isArray(j.symbols) ? j.symbols.map(String).slice(0, 6) : [],
    textInImage: String(j.textInImage ?? ""),
    quality: Math.max(0, Math.min(1, Number(j.quality ?? 0.5))),
    wordMatch: Math.max(0, Math.min(1, Number(j.wordMatch ?? 0.5))),
    songFit: Math.max(0, Math.min(1, Number(j.songFit ?? 0.5))),
    issues: Array.isArray(j.issues) ? j.issues.map(String).slice(0, 6) : [],
  };
}

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embeddings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: EMB_MODEL, prompt: text }) });
  if (!r.ok) throw new Error(`embed ${r.status}`);
  return (await r.json()).embedding;
}

// timing: does the reel's `t` sit on a sung occurrence of the word?
// Trust order: aligned.json IF its QA passed (word-level, ignoring unplaced
// t=0 stragglers) → lyrics.lrc (line-level, wider tolerance — a word can sit
// several seconds into its line) → no verdict. Reel cues come from Supabase
// lyrics_synced (what the player shows); a failed local alignment must not
// convict them (2026-07-17: 8/9 "drifting" songs were exactly this).
const T_LRC = 8.0;
function parseLrc(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (m) out.push({ t: parseInt(m[1], 10) * 60 + parseFloat(m[2]), words: new Set(m[3].split(/\s+/).map(norm).filter(Boolean)) });
  }
  return out;
}
function timingCheck({ alignedWords, alignedOk, lrc }, word, t) {
  if (t == null) return { tOk: null, tDelta: null, src: "none" }; // keyword image — no cue to verify
  const k = norm(word);
  if (alignedOk) {
    const occ = alignedWords.filter((w) => norm(w.w) === k && w.t > 0);
    if (occ.length) {
      const d = Math.min(...occ.map((o) => Math.abs(o.t - t)));
      return { tOk: d <= T_TOL, tDelta: Math.round(d * 100) / 100, src: "aligned" };
    }
  }
  const lines = lrc.filter((l) => l.words.has(k));
  if (lines.length) {
    const d = Math.min(...lines.map((l) => Math.abs(l.t - t)));
    return { tOk: d <= T_LRC, tDelta: Math.round(d * 100) / 100, src: "lrc" };
  }
  return { tOk: null, tDelta: null, src: "none" }; // not sung anywhere we can see — nothing to hold t against
}

function slotOf(key) { // lexicon/<word>/s<si>-<slot>[-recipe][-rN].webp
  const m = key.match(/\/s(\d+)-(\d+)(?:-|\.)/);
  return m ? { si: parseInt(m[1], 10), slot: parseInt(m[2], 10) } : null;
}

async function main() {
  const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : { v: 1, model: MODEL, generatedAt: null, images: {} };

  // recently-audited (key|song) pairs — a night shift loops; don't re-scan the same frame
  const fresh = new Set();
  if (fs.existsSync(AUDIT_JOURNAL)) {
    const cutoff = Date.now() - FRESH_H * 3600e3;
    for (const l of fs.readFileSync(AUDIT_JOURNAL, "utf8").split("\n")) {
      if (!l) continue;
      try { const j = JSON.parse(l); if (j.action !== "timing-only" && Date.parse(j.at) > cutoff) fresh.add(`${j.key}|${j.song}`); } catch { /* skip bad line */ }
    }
  }

  let songs = [];
  if (args.song && args.song !== true) songs = [String(args.song)];
  else if (args.songs && args.songs !== true) songs = String(args.songs).split(",").map((s) => s.trim()).filter(Boolean);
  else if (args.all) songs = fs.readdirSync(PROFILES).filter((d) => fs.existsSync(path.join(PROFILES, d, "lexicon-reel.json")));
  if (!songs.length) { console.error("need --song <id>, --songs a,b,c or --all"); process.exit(1); }

  const summary = { songs: 0, scanned: 0, skippedFresh: 0, prunes: [], misfits: [], timing: [], errors: 0 };
  const regen = new Set(fs.existsSync(REGEN) ? fs.readFileSync(REGEN, "utf8").split("\n").filter(Boolean) : []);
  const affectedSenses = new Set(); // for lexicon save decision

  for (const id of songs) {
    const reelPath = path.join(PROFILES, id, "lexicon-reel.json");
    if (!fs.existsSync(reelPath)) { log(`· ${id}: no reel — skip`); continue; }
    const reel = JSON.parse(fs.readFileSync(reelPath, "utf8"));
    const prof = JSON.parse(fs.readFileSync(path.join(PROFILES, id, "profile.json"), "utf8"));
    const analysis = prof.analysis ?? {};
    const song = {
      title: prof.identity?.title ?? id,
      story: analysis.meaning?.story || analysis.summary || "",
      themes: (analysis.themes ?? []).join(", "),
      mood: analysis.overallMood ?? "",
    };
    const alignedPath = path.join(PROFILES, id, "aligned.json");
    const aligned = fs.existsSync(alignedPath) ? JSON.parse(fs.readFileSync(alignedPath, "utf8")) : null;
    const timingSrc = {
      alignedWords: aligned?.words ?? [],
      alignedOk: aligned?.qa?.pass === true,
      lrc: parseLrc(path.join(PROFILES, id, "lyrics.lrc")),
    };

    summary.songs++;
    log(`── audit ${id}: ${reel.reel.length} reel images`);
    for (const entry of reel.reel) {
      if (!args["timing-only"] && fresh.has(`${entry.key}|${id}`)) { summary.skippedFresh++; continue; }

      // does the lexicon still hold this image? (may already be pruned)
      const word = entry.word;
      const e = lex.entries[word];
      const pos = slotOf(entry.key);
      const sense = e && pos ? e.senses[pos.si] : null;
      const held = !!sense?.images?.includes(entry.img);

      const t = timingCheck(timingSrc, word, entry.t ?? null);
      if (args["timing-only"]) { // fast pass: verify cues, no VLM / prune / index writes
        summary.scanned++;
        if (t.tOk === false) summary.timing.push({ song: id, key: entry.key, word, t: entry.t, tDelta: t.tDelta, src: t.src });
        fs.appendFileSync(AUDIT_JOURNAL, JSON.stringify({
          at: new Date().toISOString(), song: id, key: entry.key, word, line: entry.line, t: entry.t,
          tOk: t.tOk, tDelta: t.tDelta, tSrc: t.src, action: "timing-only",
        }) + "\n");
        continue;
      }
      let rd = null, action = "ok";
      try {
        const res = await fetch(entry.img);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize(672, 672, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
        rd = await vlmAudit(jpg.toString("base64"), song, entry);
      } catch (err) {
        summary.errors++;
        log(`  ! ${entry.key}: ${err.message}`);
        fs.appendFileSync(AUDIT_JOURNAL, JSON.stringify({ at: new Date().toISOString(), song: id, key: entry.key, word, error: err.message }) + "\n");
        continue;
      }
      summary.scanned++;

      const bad = rd.quality < Q_MIN || rd.wordMatch < WM_MIN;
      const misfit = rd.songFit < FIT_LOW;
      if (bad && held) action = APPLY ? "prune" : "would-prune";
      else if (bad && !held) action = "already-pruned";
      else if (misfit) action = "misfit";
      if (t.tOk === false) summary.timing.push({ song: id, key: entry.key, word, t: entry.t, tDelta: t.tDelta, src: t.src });

      // refresh the cached reading — the reel judge sees what the image actually shows
      const { issues, songFit, ...reading } = rd;
      index.images[entry.key] = { ...(index.images[entry.key] ?? { word, sense: pos?.si ?? 0, recipe: entry.recipe }), at: new Date().toISOString(), reading };
      try {
        const v = await embed(readingText(reading));
        fs.appendFileSync(EMB, JSON.stringify({ key: entry.key, dim: v.length, b64: Buffer.from(new Float32Array(v).buffer).toString("base64") }) + "\n");
      } catch (err) { log(`  ! embed ${entry.key}: ${err.message}`); }

      fs.appendFileSync(AUDIT_JOURNAL, JSON.stringify({
        at: new Date().toISOString(), song: id, key: entry.key, word, line: entry.line, t: entry.t,
        tOk: t.tOk, tDelta: t.tDelta, tSrc: t.src, quality: rd.quality, wordMatch: rd.wordMatch,
        songFit: rd.songFit, issues: rd.issues, action,
      }) + "\n");

      if (misfit) summary.misfits.push({ song: id, key: entry.key, word, songFit: rd.songFit });
      if (action === "prune") {
        fs.appendFileSync(PRUNE_JOURNAL, JSON.stringify({
          at: new Date().toISOString(), word, url: entry.img, tier: e.gravity?.tier ?? "?",
          reason: "show-audit", song: id, quality: rd.quality, wordMatch: rd.wordMatch, songFit: rd.songFit, issues: rd.issues,
        }) + "\n");
        try {
          execFileSync(RCLONE, ["deletefile", `R2:${E.BUCKET}/${entry.key}`, "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
        } catch (err) { log(`  ! R2 delete ${entry.key}: ${err.message}`); }
        sense.images = sense.images.filter((u) => u !== entry.img);
        sense.reroll = sense.reroll ?? {};
        sense.reroll[String(pos.slot)] = (sense.reroll[String(pos.slot)] || 0) + 1;
        delete index.images[entry.key];
        regen.add(word);
        affectedSenses.add(`${word}|${pos.si}`);
        summary.prunes.push({ song: id, key: entry.key, word, quality: rd.quality, wordMatch: rd.wordMatch });
        log(`  ✕ pruned ${entry.key} (q=${rd.quality} wm=${rd.wordMatch}) — reroll s${pos.si}#${pos.slot} → bump ${sense.reroll[String(pos.slot)]}`);
      } else if (action !== "ok") {
        log(`  ${action === "misfit" ? "≠" : "·"} ${action} ${entry.key} (q=${rd.quality} wm=${rd.wordMatch} fit=${rd.songFit}${t.tOk === false ? ` tΔ=${t.tDelta}s` : ""})`);
      }
    }
  }

  // persist: vision-index always (readings refreshed), lexicon only when pruned
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  if (APPLY && summary.prunes.length) {
    fs.writeFileSync(LEX, JSON.stringify(lex, null, 2));
    try {
      execFileSync(RCLONE, ["copyto", LEX, `R2:${E.BUCKET}/lexicon.json`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
      execFileSync(RCLONE, ["copyto", INDEX, `R2:${E.BUCKET}/lexicon-vision.json`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
    } catch (err) { log(`! republish: ${err.message}`); }
  }
  fs.writeFileSync(REGEN, [...regen].join("\n") + (regen.size ? "\n" : ""));

  await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, keep_alive: 0 }) }).catch(() => {});
  await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: EMB_MODEL, keep_alive: 0 }) }).catch(() => {});

  log(`✦ audit: ${summary.songs} shows · ${summary.scanned} scanned (${summary.skippedFresh} fresh-skipped) · ` +
    `${summary.prunes.length} pruned · ${summary.misfits.length} misfits · ${summary.timing.length} timing flags · ${summary.errors} errors`);
  console.log(JSON.stringify({
    songs: summary.songs, scanned: summary.scanned, skippedFresh: summary.skippedFresh,
    pruned: summary.prunes.length, misfits: summary.misfits.length, timingFlags: summary.timing.length,
    errors: summary.errors, regenWords: [...regen],
  }));
}

await main();

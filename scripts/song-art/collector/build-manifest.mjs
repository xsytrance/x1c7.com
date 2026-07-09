#!/usr/bin/env node
// Build manifest.json for the AGENOR Collector Cover System.
// For each track: fetch stems.json (verified bpm + duration), download the mp3,
// and render true waveform peaks with ffmpeg. Facts only — anything unverifiable
// stays null and the engine omits it.
//
// Usage: node build-manifest.mjs [--only <slug>]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = JSON.parse(readFileSync(join(HERE, "tracks.json"), "utf8"));
const AUDIO_DIR = join(HERE, "audio");
mkdirSync(AUDIO_DIR, { recursive: true });

const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

// Audio URLs straight from the live rows (queried 2026-07-09). Key = slug.
const AUDIO = {
  "1st-of-the-month-walk-it-out": "music/1st%20of%20the%20Month%20(Walk%20It%20Out).mp3",
  "ai-interlude": "music/AI%20Interlude.mp3",
  "amor-de-verdad": "music/Amor%20De%20Verdad.mp3",
  "between-the-stations": "music/Between%20The%20Stations.mp3",
  "oro-de-la-presion": "music/Oro%20De%20La%20Presi%C3%B3n.mp3",
  "brooms-in-the-boiler-room": "music/Brooms%20in%20the%20Boiler%20Room.mp3",
  "cairo-still-dancing": "music/Cairo%20Still%20Dancing.mp3",
  "ceasefire-in-the-static-data-storm-version": "music/Ceasefire%20in%20the%20Static%20(Data%20Storm%20Version).mp3",
  "drink-drink-don-t-save-me": "music/Drink%20Drink%20%5BDon%E2%80%99t%20Save%20Me%5D.mp3",
  "fast-enough": "music/Fast%20Enough.mp3",
  "feverbreak": "music/Feverbreak.mp3",
  "going-crazy-hiligaynon-fusion-mix": "music/Going%20Crazy%20(Hiligaynon%20Fusion%20Mix).mp3",
  "heaven-hell-honey-venom-remix": "music/Heaven%20%26%20Hell%20(Honey%20%26%20Venom%20Remix).mp3",
  "honey-n-venom-rude-wine-riddim": "music/Honey%20N%20Venom%20(Rude%20Wine%20Riddim).mp3",
  "i-don-t-quit-right-now": "music/I%20Don't%20Quit%20Right%20Now.mp3",
  "i-said-no": "music/I%20Said%20No!.mp3",
  "in-love-with-the-party": "music/In%20Love%20With%20The%20Party.mp3",
  "light-it-myself": "music/Light%20It%20Myself%20(%EB%B6%88%EC%9D%80%20%EB%82%B4%EA%B0%80).mp3",
  "low-lights-tokyo-night": "music/Low%20Lights%20Tokyo%20_%20%E5%90%9B%E3%81%8C%E3%81%84%E3%81%AA%E3%81%84Night.mp3",
  "membrane-still-insane": "music/Membrane%20Still%20Insane.mp3",
  "mi-gente": "music/Mi%20Gente.mp3",
  "move-over-minimal-groove-mix": "music/Move%20Over%20(Minimal%20Groove%20Mix).mp3",
  "music-is-my-drug-rooklyn-mix": "music/Music%20Is%20My%20Drug%20(Rooklyn%20Mix).mp3",
  "music-is-my-drug": "music/Music%20Is%20My%20Drug.mp3",
  "one-more-breath-back-to-myself": "music/One%20More%20Breath%20%5BBack%20To%20Myself%5D.mp3",
  "one-tap-away-riverboat-bad-boys-remix": "music/One%20Tap%20Away%20(Riverboat%20Bad%20Boys%20Remix).mp3",
  "one-tap-away": "music/One%20Tap%20Away.mp3",
  "push-it-on-me": "music/Push%20It%20On%20Me.mp3",
  "say-it-with-your-eyes": "music/Say%20It%20With%20Your%20Eyes.mp3",
  "still-me-still-you": "music/Still%20Me_%20Still%20You.mp3",
  "void-into-gold-forged-above-gold-mix": "music/Void%20Into%20Gold%20(Forged%20Above%20Gold%20Mix).mp3",
  "void-into-gold": "music/Void%20Into%20Gold.mp3",
  "whistle-on-the-river": "music/Whistle%20on%20the%20River.mp3",
  "jayodeed-going-crazy-rooklyn-mix": "music/xsytrance%20presents%20Jayodeed%20-%20Going%20Crazy%20(Rooklyn%20Mix).mp3",
  "different-this-summer": "music/Different%20This%20Summer.mp3",
  "i-won-t-be-your-fire-japanese-mix": "music/I%20Won%E2%80%99t%20Be%20Your%20Fire%20(Japanese%20Mix).mp3",
  "i-won-t-be-your-fire": "music/I%20Won%E2%80%99t%20Be%20Your%20Fire.mp3",
  "i-m-that-somebody": "music/I'm%20That%20Somebody.mp3",
  "veneno-y-miel": "music/Veneno%20Y%20Miel.mp3",
  "my-soul-lives-in-seoul": "music/My%20Soul%20Lives%20In%20Seoul.mp3",
  "paper-that-cut-you": "music/Paper%20That%20Cut%20You.mp3",
  "cocktails-and-code": "music/Cocktails%20%26%26%20Code.mp3",
  "the-big-top-has-wi-fi-now": "music/The%20Big%20Top%20Has%20Wi-Fi.mp3",
  "23-respuestas": "music/23%20Respuestas.mp3",
  "red-flags-from-the-beginning": "music/Red%20Flags%20From%20The%20Beginning.mp3",
  "under-the-elevated": "music/Under%20the%20Elevated.mp3",
  "who-s-that-snake-funky-slow-jam-mix": "music/Who's%20That%20Snake%20(Funky%20Slow-Jam%20Mix).mp3",
  "another-year-looks-good-on-you-happy-birthday-song": "music/Another%20Year%20Looks%20Good%20on%20You%20%5BHappy%20Birthday%20Song%5D.mp3",
};

// Slugs whose stems.json exists in R2 (queried from tracks.planet.assets.stems).
const NO_STEMS = new Set(["feverbreak", "music-is-my-drug-rooklyn-mix", "different-this-summer", "my-soul-lives-in-seoul", "paper-that-cut-you", "who-s-that-snake-funky-slow-jam-mix", "another-year-looks-good-on-you-happy-birthday-song"]);

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function stemsMeta(slug) {
  if (NO_STEMS.has(slug)) return {};
  try {
    const r = await fetch(`${PUB}/planets/${slug}/stems/stems.json`);
    if (!r.ok) return {};
    const j = await r.json();
    return { bpm: j.bpm ? Math.round(j.bpm) : null, durationSec: j.duration || null };
  } catch { return {}; }
}

function peaksFor(slug) {
  const mp3 = join(AUDIO_DIR, `${slug}.mp3`);
  if (!existsSync(mp3)) return null;
  // mono 8kHz signed 16-bit PCM → 96 max-abs buckets, normalized 0..1
  const pcm = execFileSync("ffmpeg", ["-v", "quiet", "-i", mp3, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  const n = pcm.length >> 1, buckets = 96, out = new Array(buckets).fill(0);
  for (let i = 0; i < n; i++) {
    const v = Math.abs(pcm.readInt16LE(i << 1));
    const b = Math.min(buckets - 1, Math.floor((i / n) * buckets));
    if (v > out[b]) out[b] = v;
  }
  const max = Math.max(...out, 1);
  return out.map((v) => +(v / max).toFixed(3));
}

function durationOf(slug) {
  const mp3 = join(AUDIO_DIR, `${slug}.mp3`);
  if (!existsSync(mp3)) return null;
  const out = execFileSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim();
  return parseFloat(out) || null;
}

const manifest = [];
for (const t of SRC.tracks) {
  if (only && t.slug !== only) continue;
  if (t.done) { console.error(`skip (already done): ${t.slug}`); continue; }
  if (!t.coverFile) { console.error(`skip (no original art): ${t.slug}`); continue; }
  const rec = { ...t };
  const audio = AUDIO[t.slug];
  if (audio) {
    const mp3 = join(AUDIO_DIR, `${t.slug}.mp3`);
    if (!existsSync(mp3)) {
      console.error(`fetch audio: ${t.slug}`);
      const r = await fetch(`${PUB}/${audio}`);
      if (r.ok) writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
      else console.error(`  audio ${r.status} — skipping waveform`);
    }
    const meta = await stemsMeta(t.slug);
    rec.bpm = meta.bpm ?? null;
    const dur = meta.durationSec ?? durationOf(t.slug);
    rec.runtime = dur ? fmtTime(dur) : null;
    rec.peaks = peaksFor(t.slug);
    console.error(`  ${t.slug}: bpm=${rec.bpm ?? "—"} runtime=${rec.runtime ?? "—"} peaks=${rec.peaks ? "yes" : "no"}`);
  } else {
    rec.bpm = null; rec.runtime = null; rec.peaks = null;
  }
  manifest.push(rec);
}
for (const t of SRC.unreleased) {
  if (only && t.slug !== only) continue;
  manifest.push({ ...t, bpm: null, runtime: null, peaks: null, unreleased: true });
}
writeFileSync(join(HERE, "manifest.json"), JSON.stringify(manifest, null, 1));
console.error(`\nwrote manifest.json with ${manifest.length} entries`);

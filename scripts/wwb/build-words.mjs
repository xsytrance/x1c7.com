#!/usr/bin/env node
// Rebuild lyrics_synced.words for the "Warm Without Burning" final-chorus cut.
//
// Why this exists: the profile was onboarded audio-only and demucs is missing
// from every venv on the box, so transcribe.py ran on the full mix and Whisper
// hallucinated. The shipped lyrics.lrc / tracks.lyrics are an ASR DRAFT — every
// Vietnamese line came back as English phonetics and the outro ambience came
// back as invented English. Rendering those would put wrong words on screen.
//
// Line TEXT is the Sovereign's official-lyrics.txt (authoritative).
// Line TIMES are measured off the REAL LEAD VOCAL STEM
// (assets/stems/<song> Stems.zip -> "0 Lead Vocals.mp3"), not the mix:
// faster-whisper large-v3 word timestamps over the isolated stem for the sung
// block, and a -46dB phrase map over the same stem for the whispered outro,
// where the vocal is the only thing playing. Every line start is gate-checked
// against lead-stem energy in the 250-3500Hz band.
//
// Decode the stems with ffmpeg, NOT librosa/libsndfile: these Suno mp3s carry
// bogus duration headers (ffprobe reports 366s and 755s for a 246.4s song) and
// libsndfile truncates on them - the old stem-truncation bug in a new place.
// ffmpeg -i "0 Lead Vocals.mp3" -ar 22050 -ac 1 lead.wav gives the true 246.43s.
//
// Words are distributed evenly inside each line span (playbook §2 recipe).
import { writeFileSync } from "node:fs";

// [start, end, text] — measured spans, official text.
const LINES = [
  // ── Final Chorus (Kizuna lead, full band) ──
  [182.73, 184.10, "Warm without burning"],
  [185.14, 186.05, "Ấm mà không cháy"],
  [186.10, 187.44, "No need for fire"],
  [187.46, 189.30, "to make me stay"],
  [189.34, 191.86, "You don't have to break"],
  [191.88, 193.64, "để biết rằng em quan tâm"],
  [194.31, 196.20, "Warm without burning"],
  [196.28, 198.15, "Nước đang rơi đêm nay"],
  [198.20, 199.42, "The fire is gone"],
  [200.49, 201.54, "mà em vẫn ở đây"],
  // ── Final Variation (Kizuna, close) ──
  [201.93, 203.06, "I'm still here"],
  [203.37, 205.35, "when the fire is gone"],
  [205.42, 206.56, "Em vẫn ở đây"],
  [206.75, 207.95, "khi thành phố yên"],
  [208.14, 209.30, "No scars"],
  [209.50, 211.16, "No reason to run"],
  [211.99, 213.45, "Chỉ có hơi ấm"],
  [213.54, 216.24, "không thiêu cháy ai"],
  // ── Outro – Hàn River (whispers over water) ──
  [222.80, 226.37, "I thought somebody only stayed"],
  [226.58, 228.44, "if it hurt"],
  [228.76, 229.90, "Không"],
  [230.30, 233.49, "Em ở lại"],
  [233.94, 235.35, "dù chẳng ai đau"],
  [243.57, 246.30, "Ấm mà không cháy"],
];

const words = [];
for (const [start, end, text] of LINES) {
  const ws = text.split(/\s+/).filter(Boolean);
  const step = (end - start) / ws.length;
  ws.forEach((w, i) => words.push({ t: +(start + i * step).toFixed(3), w }));
}

// Guard: strictly increasing, no two words closer than 40ms.
for (let i = 1; i < words.length; i++) {
  if (words[i].t <= words[i - 1].t) throw new Error(`non-monotonic at ${i}: ${words[i].w}`);
}
const tight = words.filter((w, i) => i && w.t - words[i - 1].t < 0.04);
if (tight.length) console.warn("tight words:", tight.map((w) => w.w).join(","));

writeFileSync("scripts/wwb/words.json", JSON.stringify(words, null, 1));
console.log(`${LINES.length} lines -> ${words.length} words, ${words[0].t}s .. ${words.at(-1).t}s`);

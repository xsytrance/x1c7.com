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
// Line TIMES are measured: faster-whisper large-v3 word timestamps over a
// librosa REPET-SIM foreground of 176-246.5s, cross-checked against the
// onboarding transcript's segment boundaries, and gate-checked so every line
// start sits on real vocal energy (250-3500Hz band, see docs).
//
// Words are distributed evenly inside each line span (playbook §2 recipe).
import { writeFileSync } from "node:fs";

// [start, end, text] — measured spans, official text.
const LINES = [
  // ── Final Chorus (Kizuna lead, full band) ──
  [182.40, 184.30, "Warm without burning"],
  [184.35, 186.00, "Ấm mà không cháy"],
  [186.04, 187.45, "No need for fire"],
  [187.49, 189.34, "to make me stay"],
  [189.38, 191.84, "You don't have to break"],
  [191.88, 193.78, "để biết rằng em quan tâm"],
  [193.82, 196.00, "Warm without burning"],
  [196.02, 198.05, "Nước đang rơi đêm nay"],
  [198.30, 199.30, "The fire is gone"],
  [199.60, 201.40, "mà em vẫn ở đây"],
  // ── Final Variation (Kizuna, close) ──
  [201.64, 202.90, "I'm still here"],
  [202.94, 205.30, "when the fire is gone"],
  [205.40, 206.68, "Em vẫn ở đây"],
  [206.75, 207.90, "khi thành phố yên"],
  [208.00, 209.30, "No scars"],
  [209.46, 211.12, "No reason to run"],
  [211.99, 213.60, "Chỉ có hơi ấm"],
  [213.72, 216.24, "không thiêu cháy ai"],
  // ── Outro – Hàn River (whispers over water) ──
  [223.52, 225.60, "I thought somebody only stayed"],
  [225.62, 227.50, "if it hurt"],
  [227.54, 228.60, "Không"],
  [228.70, 231.22, "Em ở lại"],
  [233.50, 234.90, "dù chẳng ai đau"],
  [243.20, 245.20, "Ấm mà không cháy"],
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

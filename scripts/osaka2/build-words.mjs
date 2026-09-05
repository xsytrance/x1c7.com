#!/usr/bin/env node
// Rebuild lyrics_synced.words for the "Osaka After Dark" RE-CUT.
//
// The shipped 56s cut covered 155.02-211.35 (the dancehall breakdown + final
// chorus) and tracks.lyrics_synced still holds ONLY that window. This cut is a
// different stretch of the song — the first chorus at 1:13 through the end of
// the Female Lead section — so the word array is built from scratch.
//
// Line TEXT is the Sovereign's assets/lyrics/osakaafterdark.txt (authoritative).
// Line TIMES come from the existing lead-stem whisper pass
// (profiles/osaka-after-dark/whisper-lead.json), which carries WORD-level
// stamps — needed because several official lines share one ASR segment
// (the four male ad-libs land in a single 5s blob, and the male-response
// couplets are two lines each). The lead stem itself is continuous at -38dB
// across the whole window, so an energy gate cannot split these; the word
// stamps can.
import { writeFileSync } from "node:fs";

// [start, end, text] — measured spans, official text.
const LINES = [
  // ── Chorus (female lead, male ad-libs) ──
  [73.58, 75.60, "Wine with me, wine with me"],
  [75.74, 78.10, "Osaka after dark, come grind with me"],
  [78.16, 80.20, "Neon light dripping, gold all on the floor"],
  [80.28, 82.62, "He said yamenaide, so I gave him more"],
  [82.68, 85.00, "Body on beat, no talking too much"],
  [85.06, 87.40, "Hip-hop swing with the dancehall touch"],
  [87.46, 89.88, "Ne, kimi, come close, let the rhythm get rude"],
  [89.94, 92.00, "Konya wa nemuranai, we don't need no room"],
  // ── Male ad-libs (one 5s ASR blob, split on word stamps) ──
  [92.04, 93.20, "Come closer"],
  [93.26, 94.55, "Sawatte"],
  [94.62, 95.80, "So hot, ma"],
  [95.84, 97.08, "Yamenaide"],
  // ── Verse 2 (female lead, hip-hop pocket) ──
  [97.60, 100.40, "Okay, hips got grammar, I speak in motion"],
  [100.44, 102.95, "Plum wine vibe with a neon ocean"],
  [103.00, 105.15, "No sweet talk, just bass and devotion"],
  [105.22, 107.90, "I bend this rhythm 'cause I own the quotient"],
  [107.94, 110.10, "Tokyo in my blood but Osaka in the heat"],
  [110.16, 112.50, "Kansai on my tongue when I wine on the beat"],
  [112.56, 114.50, "She got that midnight, please-save-me face"],
  [114.56, 116.90, "Gomen ne, I don't do grace"],
  // ── Male response (couplets sharing one segment each) ──
  [116.94, 118.10, "You always this cold?"],
  [118.26, 119.00, "Don't act shy"],
  [119.44, 120.60, "Look me in the dark"],
  [120.74, 121.35, "Tell me why"],
  // ── Female lead ──
  [121.42, 124.40, "I don't ask, I read body language"],
  [124.44, 126.65, "You say stop, then I stop, no panic"],
  [126.70, 129.70, "But you said yamenaide with your hand on my chain"],
  [129.76, 132.08, "Now the bassline dirty and the room feel insane"],
];

const words = [];
for (const [start, end, text] of LINES) {
  const ws = text.split(/\s+/).filter(Boolean);
  const step = (end - start) / ws.length;
  ws.forEach((w, i) => words.push({ t: +(start + i * step).toFixed(3), w }));
}
for (let i = 1; i < words.length; i++) {
  if (words[i].t <= words[i - 1].t) throw new Error(`non-monotonic at ${i}: ${words[i].w}`);
}
writeFileSync("scripts/osaka2/words.json", JSON.stringify(words, null, 1));
console.log(`${LINES.length} lines -> ${words.length} words, ${words[0].t}s .. ${words.at(-1).t}s`);

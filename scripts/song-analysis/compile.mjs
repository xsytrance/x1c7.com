#!/usr/bin/env node
// compile.mjs — the Splice Table deterministic compiler.
// Pure function: a flow (which legos, from which songs, plus knobs) -> a Suno prompt.
// No LLM, no canvas, no randomness. This is the never-breaks fallback the graph
// compiles down to, and the thing that proves the seams stitch before any UI exists.
//
//   node scripts/song-analysis/compile.mjs                 # run the built-in Frankenstein demo
//   node scripts/song-analysis/compile.mjs path/to/flow.json
//
// A flow:
//   {
//     "title": null,                                  // null => auto
//     "style": { "from": "<songId>", "overrides": { "bpm": 105, "mood": "..." } },
//     "arrangement": [
//       { "ref": "<songId>::<kind>...::<i>", "as": "chorus" }   // 'as' relabels the section
//     ],
//     "knobs": { "weirdness": 25, "styleStrength": 70, "audioInfluence": 0, "voice": "auto" },
//     "exclude": ["harsh autotune"]
//   }

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = join(HERE, 'profiles');

// ---------- lego loading --------------------------------------------------

const legoCache = new Map();
export function loadSong(songId) {
  if (legoCache.has(songId)) return legoCache.get(songId);
  const p = join(PROFILES, songId, 'song-legos.json');
  if (!existsSync(p)) throw new Error(`no legos for song "${songId}" (${p})`);
  const legos = JSON.parse(readFileSync(p, 'utf8'));
  legoCache.set(songId, legos);
  return legos;
}
const songIdOf = (ref) => ref.split('::')[0];
function resolveSection(ref) {
  const song = loadSong(songIdOf(ref));
  const section = song.sections.find((s) => s.id === ref);
  if (!section) throw new Error(`section "${ref}" not found in ${song.id}`);
  return { song, section };
}

// ---------- music theory: the conflict resolver (feature #1) ---------------

const PC = { C: 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, F: 5, 'F#': 6, GB: 6,
  G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11 };
function pitchClass(key) {
  if (!key) return null;
  const k = key.trim().toUpperCase().replace('♯', '#').replace('♭', 'B');
  return k in PC ? PC[k] : null;
}
// smallest signed semitone move from -> to, in [-6, +6]
function semitoneDelta(fromKey, toKey) {
  const a = pitchClass(fromKey), b = pitchClass(toKey);
  if (a == null || b == null) return null;
  let d = (b - a) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

// Compare a borrowed section's home tempo/key against the target and score the seam.
function analyzeSeam(target, source) {
  const ratio = source.bpm && target.bpm ? source.bpm / target.bpm : null;
  let bpmVerdict = 'match', bpmPenalty = 0;
  if (ratio != null) {
    if (ratio < 0.97 || ratio > 1.03) { bpmVerdict = 'stretch'; bpmPenalty = 8; }
    if (ratio < 0.85 || ratio > 1.18) { bpmVerdict = 'hard-stretch'; bpmPenalty = 22; }
  }
  const semis = semitoneDelta(source.key, target.key);
  const modeFlip = source.mode && target.mode && source.mode !== target.mode;
  let keyVerdict = 'match', keyPenalty = 0;
  if (semis !== 0 && semis != null) { keyVerdict = 'transpose'; keyPenalty = Math.min(18, Math.abs(semis) * 5); }
  if (modeFlip) { keyVerdict = keyVerdict === 'match' ? 'mode-flip' : 'transpose+mode'; keyPenalty += 10; }
  if ((semis != null && Math.abs(semis) > 3)) { keyVerdict = 'clash'; keyPenalty += 8; }

  const suggestions = [];
  if (bpmVerdict === 'stretch')
    suggestions.push(`tempo off (${source.bpm}→${target.bpm} BPM, ${ratio.toFixed(2)}×) — Suno will re-sing it at target, expect slight phrasing drift`);
  if (bpmVerdict === 'hard-stretch')
    suggestions.push(`tempo far off (${source.bpm}→${target.bpm} BPM, ${ratio.toFixed(2)}×) — don't warp; let Suno re-generate this section at ${target.bpm} BPM or halftime/doubletime it`);
  if (semis && semis !== 0)
    suggestions.push(`transpose ${sign(semis)} semitone${Math.abs(semis) === 1 ? '' : 's'} (${source.key} → ${target.key})`);
  if (modeFlip)
    suggestions.push(`mode flip: source ${source.mode}, target ${target.mode} — flatten/raise the 3rd (& 6th/7th) or let Suno re-harmonize the borrowed melody`);

  return {
    match: bpmVerdict === 'match' && keyVerdict === 'match',
    bpm: { ratio: ratio == null ? null : Math.round(ratio * 100) / 100, verdict: bpmVerdict },
    key: { semitones: semis, modeFlip, verdict: keyVerdict },
    penalty: bpmPenalty + keyPenalty,
    suggestions,
  };
}

// ---------- Suno rendering ------------------------------------------------

const KIND_TAG = {
  intro: 'Intro', verse: 'Verse', prechorus: 'Pre-Chorus', chorus: 'Chorus',
  postchorus: 'Post-Chorus', hook: 'Hook', bridge: 'Bridge', breakdown: 'Break',
  drop: 'Drop', outro: 'Outro', spoken: 'Spoken Word', interlude: 'Interlude',
  adlib: 'Ad-libs', refrain: 'Refrain', other: 'Refrain',
};

// Turn a section's voice + the flow's global voice knob into a Suno tag suffix.
function voiceLabel(sectionVoice, knobVoice) {
  const forced = knobVoice && knobVoice !== 'auto' ? knobVoice : null; // male|female|both|undecided
  let gender = forced || sectionVoice.gender;
  if (gender === 'undecided') gender = null;
  const parts = [];
  if (gender === 'both') parts.push('Duet');
  else if (gender === 'male') parts.push('Male');
  else if (gender === 'female') parts.push('Female');
  else if (gender === 'ai') parts.push('AI');
  if (sectionVoice.group && gender !== 'both') parts.push('Group');
  if (sectionVoice.spoken) parts.push('Spoken');
  return parts.join(' ');
}

function renderStyle(style, knobs, exclude) {
  const bits = [];
  if (style.genre) bits.push(style.genre);
  if (style.subGenres?.length) bits.push(style.subGenres.join(', '));
  if (style.mood) bits.push(style.mood.toLowerCase());
  const tempoKey = [];
  if (style.bpm) tempoKey.push(`${style.bpm} BPM`);
  if (style.key) tempoKey.push(`${style.key}${style.mode ? ' ' + style.mode : ''}`);
  if (tempoKey.length) bits.push(tempoKey.join(', '));
  if (style.vocalStyle) bits.push(style.vocalStyle.toLowerCase());
  const v = knobs.voice && knobs.voice !== 'auto' ? knobs.voice : null;
  if (v) bits.push(`${v} vocals`);
  let s = bits.join('; ');
  if (exclude?.length) s += `.  Exclude: ${exclude.join(', ')}`;
  return s;
}

// ---------- title (deterministic, no RNG) ---------------------------------

function autoTitle(flow, styleSong, resolved) {
  if (flow.title) return flow.title;
  // Prefer the hook/chorus we're building around — that's where real titles live.
  const hook = resolved.find((r) => ['chorus', 'hook'].includes(r.as || r.section.kind));
  if (hook) {
    const firstLine = hook.section.text.split('\n').find((l) => l.trim());
    if (firstLine) {
      const words = firstLine.replace(/[^\w\s'&]/g, '').split(/\s+/).filter(Boolean).slice(0, 4);
      if (words.length) return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // Fallback: pair the two strongest signature words of the style song.
  const sig = styleSong.signature.map((s) => s.word);
  if (sig.length >= 2) return `${cap(sig[0])} & ${cap(sig[1])}`;
  return styleSong.title;
}
const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w);

// ---------- compile -------------------------------------------------------

export function compile(flow) {
  const styleSong = loadSong(flow.style.from);
  const style = { ...styleSong.style, ...(flow.style.overrides || {}) };
  const knobs = { weirdness: 20, styleStrength: 65, audioInfluence: 0, voice: 'auto', ...(flow.knobs || {}) };
  const target = { bpm: style.bpm, key: style.key, mode: style.mode };

  const resolved = flow.arrangement.map((item) => {
    const { song, section } = resolveSection(item.ref);
    const borrowed = song.id !== styleSong.id;
    const seam = borrowed
      ? analyzeSeam(target, { bpm: song.style.bpm, key: song.style.key, mode: song.style.mode })
      : { match: true, penalty: 0, suggestions: [] };
    return { ...item, song, section, borrowed, seam };
  });

  // lyrics block
  const lyricLines = [];
  for (const r of resolved) {
    const kind = r.as || r.section.kind;
    const tagName = KIND_TAG[kind] || cap(kind);
    const vl = voiceLabel(r.section.voice, knobs.voice);
    lyricLines.push(`[${tagName}${vl ? ' - ' + vl : ''}]`);
    lyricLines.push(r.section.text.trim());
    lyricLines.push('');
  }

  // provenance (feature #10) — donor breakdown
  const donors = {};
  for (const r of resolved) {
    const label = r.song.artist || r.song.id;
    donors[label] = donors[label] || [];
    donors[label].push(`${r.as || r.section.kind}${r.section.ordinal ? ' ' + r.section.ordinal : ''}`);
  }

  // compatibility score (feature #2), aggregate
  const totalPenalty = resolved.reduce((a, r) => a + r.seam.penalty, 0);
  const compatibility = Math.max(0, 100 - totalPenalty);

  const warnings = resolved
    .filter((r) => r.borrowed && r.seam.suggestions.length)
    .map((r) => ({ ref: r.section.id, from: r.song.artist || r.song.id, ...r.seam }));

  return {
    title: autoTitle(flow, styleSong, resolved),
    styleOfMusic: renderStyle(style, knobs, flow.exclude),
    lyrics: lyricLines.join('\n').trim(),
    params: {
      weirdness: knobs.weirdness,
      styleStrength: knobs.styleStrength,
      audioInfluence: knobs.audioInfluence,
      vocalGender: knobs.voice,
      excludeStyles: flow.exclude || [],
    },
    target,
    compatibility,
    warnings,
    provenance: donors,
  };
}

// ---------- pretty print --------------------------------------------------

export function render(out) {
  const bar = '─'.repeat(64);
  const L = [];
  L.push(bar);
  L.push(`  🎛  SPLICE TABLE — compiled Suno prompt`);
  L.push(bar);
  L.push(`  TITLE        ${out.title}`);
  L.push(`  COMPAT       ${out.compatibility}/100  ${compatBar(out.compatibility)}`);
  L.push(`  VOICE        ${out.params.vocalGender}   WEIRD ${out.params.weirdness}%   STYLE ${out.params.styleStrength}%   AUDIO ${out.params.audioInfluence}%`);
  L.push('');
  L.push(`  STYLE OF MUSIC`);
  L.push(wrap(out.styleOfMusic, 60, '    '));
  L.push('');
  L.push(`  PROVENANCE`);
  for (const [who, parts] of Object.entries(out.provenance))
    L.push(`    ${who} → ${parts.join(', ')}`);
  if (out.warnings.length) {
    L.push('');
    L.push(`  ⚠  SEAM WARNINGS  (conflict resolver)`);
    for (const w of out.warnings) {
      L.push(`    • ${w.ref}  (from ${w.from})`);
      for (const s of w.suggestions) L.push(`        - ${s}`);
    }
  }
  L.push('');
  L.push(bar);
  L.push(`  LYRICS  (paste into Suno)`);
  L.push(bar);
  L.push(out.lyrics);
  L.push(bar);
  return L.join('\n');
}
function compatBar(n) { const f = Math.round(n / 10); return '█'.repeat(f) + '░'.repeat(10 - f); }
function wrap(s, w, pad) {
  const words = s.split(' '); const lines = []; let cur = pad;
  for (const word of words) {
    if ((cur + word).length > w + pad.length) { lines.push(cur); cur = pad + word + ' '; }
    else cur += word + ' ';
  }
  if (cur.trim()) lines.push(cur);
  return lines.join('\n');
}

// ---------- built-in demo -------------------------------------------------

// A real Frankenstein: AGENOR's "Cocktails && Code" body (99 BPM, G minor),
// jayodeed's going-crazy hook grafted in as the chorus (144 BPM, G major — big clash),
// and international-heat's bridge (99 BPM, F# major — +1 semitone, mode flip).
const DEMO_FLOW = {
  title: null,
  style: { from: 'cocktails-and-code', overrides: {} },
  arrangement: [
    { ref: 'cocktails-and-code::intro::0' },
    { ref: 'cocktails-and-code::verse-1::2' },
    { ref: 'jayodeed-going-crazy-rooklyn-mix::chorus::1', as: 'chorus' },
    { ref: 'cocktails-and-code::verse-2::6' },
    { ref: 'international-heat::bridge::6', as: 'bridge' },
    { ref: 'jayodeed-going-crazy-rooklyn-mix::chorus::1', as: 'chorus' },
    { ref: 'cocktails-and-code::outro::12', as: 'outro' },
  ],
  knobs: { weirdness: 30, styleStrength: 72, audioInfluence: 0, voice: 'auto' },
  exclude: ['harsh autotune', 'screaming'],
};

function main() {
  const flowPath = process.argv[2];
  let flow = DEMO_FLOW;
  if (flowPath) {
    flow = JSON.parse(readFileSync(flowPath, 'utf8'));
  } else {
    console.log('(no flow given — running built-in Frankenstein demo)\n');
  }
  let out;
  try { out = compile(flow); }
  catch (e) { console.error(`compile error: ${e.message}`); process.exit(1); }
  console.log(render(out));
  const dest = flowPath ? flowPath.replace(/\.json$/, '') + '.compiled.json'
    : join(HERE, 'demo.compiled.json');
  writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`\n  full object -> ${dest}`);
}

// Only run the demo when invoked directly, not when imported by splice.mjs.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

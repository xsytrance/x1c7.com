#!/usr/bin/env node
// legos.mjs — Splice Table compiler feedstock.
// Transforms each song-analysis profile (profile.json + aligned.json + lexicon-reel.json)
// into ONE self-contained lego set: song-legos.json.  Also emits a catalog index the
// canvas loads on boot.  Pure transform over existing files — generates nothing new.
//
//   node scripts/song-analysis/legos.mjs            # build all profiles
//   node scripts/song-analysis/legos.mjs cocktails-and-code   # one profile, prints result
//
// Schema version: bump LEGO_V on breaking changes so the compiler can gate.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEGO_V = 1;
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = join(HERE, 'profiles');
// The /splice web tool reads these as static assets (FREE tier compiles in-tab,
// no server). One build refreshes both the profile sidecars and the public copy.
const PUBLIC = join(HERE, '..', '..', 'public', 'splice');

// ---------- section-tag normalization ------------------------------------

// Canonical section kinds the compiler reasons about. Order matters: first hit wins.
const KIND_RULES = [
  [/\bpre[-\s]?chorus\b/i, 'prechorus'],
  [/\bpost[-\s]?chorus\b/i, 'postchorus'],
  [/\bfinal\s+chorus\b/i, 'chorus'],
  [/\bfinal\s+hook\b/i, 'hook'],
  [/\bchorus\b/i, 'chorus'],
  [/\bhook\b/i, 'hook'],
  [/\bverse\b/i, 'verse'],
  [/\bbridge\b/i, 'bridge'],
  [/\bbreakdown\b/i, 'breakdown'],
  [/\bdrop\b/i, 'drop'],
  [/\bintro\b/i, 'intro'],
  [/\boutro\b/i, 'outro'],
  [/\brefrain\b/i, 'refrain'],
  [/\binterlude\b/i, 'interlude'],
  [/\bad[-\s]?lib/i, 'adlib'],
  [/\bspoken\b/i, 'spoken'],
  [/^sfx\b|\bsfx:/i, 'sfx'],
];

function classifyKind(raw) {
  for (const [re, kind] of KIND_RULES) if (re.test(raw)) return kind;
  return 'other';
}

// Pull a verse/section ordinal if present ([Verse 2] -> 2).
function ordinal(raw) {
  const m = raw.match(/\b(?:verse|hook|chorus|drop)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

// Voice = who sings it. Suno cares about male/female/group/duet. We keep the raw
// descriptor too so the LLM compiler can use flavor ("Smooth Rap", "DJ", "Group Vocals").
function classifyVoice(raw) {
  const s = raw.toLowerCase();
  let gender = null;
  const female = /\bfemale\b/.test(s);
  const male = /\bmale\b/.test(s);
  if ((female && male) || /\bboth\b|\bduet\b/.test(s)) gender = 'both';
  else if (female) gender = 'female';
  else if (male) gender = 'male';
  else if (/\bai voice\b|\bai\b/.test(s)) gender = 'ai';
  else if (/\bcrew\b|\bgroup\b|\bvocals\b/.test(s)) gender = 'group';
  const group = /\bgroup\b|\bcrew\b|\bvocals\b/.test(s);
  const spoken = /\bspoken\b/.test(s);
  // descriptor = the flavor half of "Verse 1 - Male Smooth Rap"
  const descriptor = raw.includes(' - ') ? raw.split(' - ').slice(1).join(' - ').trim() : null;
  return { gender, group: group || null, spoken: spoken || null, descriptor };
}

// ---------- lyric parsing -------------------------------------------------

// Split "[Intro]\nline\nline\n\n[Verse 1 - ...]\n..." into ordered section blocks.
function parseSections(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  for (const line of lines) {
    const tag = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (tag) {
      if (cur) out.push(cur);
      cur = { raw: tag[1].trim(), lines: [] };
    } else if (cur && line.trim()) {
      cur.lines.push(line.trim());
    } else if (!cur && line.trim()) {
      // pre-tag stray lines -> synthetic intro
      cur = { raw: 'Intro', lines: [line.trim()] };
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- section <-> time alignment (best-effort, nullable) ------------

const normToken = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

// Find the first index >= from where the 3-gram appears in the aligned token stream.
function findNgram(tokens, from, gram) {
  if (gram.length === 0) return -1;
  for (let i = Math.max(0, from); i <= tokens.length - gram.length; i++) {
    let ok = true;
    for (let j = 0; j < gram.length; j++) {
      if (tokens[i + j].n !== gram[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

// Walk sections in order, matching each section's opening words into the word-level
// aligned stream to recover an approximate start time. Fuzzy by design; leaves null on miss.
function alignSections(sections, alignedWords) {
  if (!alignedWords?.length) return;
  const tokens = alignedWords.map((w) => ({ t: w.t, n: normToken(w.w) })).filter((x) => x.n);
  let cursor = 0;
  for (const sec of sections) {
    const body = sec.lines.join(' ').split(/\s+/).map(normToken).filter(Boolean);
    if (body.length < 2) { sec.startT = null; continue; }
    const gram = body.slice(0, Math.min(3, body.length));
    const idx = findNgram(tokens, cursor, gram);
    if (idx >= 0) { sec.startT = round2(tokens[idx].t); cursor = idx + gram.length; }
    else sec.startT = null;
  }
}

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

// ---------- assembly ------------------------------------------------------

// Guess a collaborator from the slug so cross-artist splicing has attribution to start from.
const KNOWN_ARTISTS = ['jayodeed', 'rooklyn', 'tylerhaze', 'patrick'];
function guessArtist(id) {
  const lc = id.toLowerCase();
  for (const a of KNOWN_ARTISTS) if (lc.includes(a)) return a;
  return null; // owner fills in; default handled at consumption
}

function buildLegos(dir, id) {
  const profile = readJSON(join(dir, 'profile.json'));
  if (!profile) return null;
  const aligned = readJSON(join(dir, 'aligned.json'));
  const lexicon = readJSON(join(dir, 'lexicon-reel.json'));

  const idn = profile.identity || {};
  const measured = profile.measured || {};
  const mix = profile.mixFeatures || {};
  const key = mix.keyEstimate || mix.key || {};
  const bpm = measured.bpm ?? profile.measured?.bpm ?? null;
  const duration = measured.duration ?? null;
  const secPerBar = bpm ? (60 / bpm) * 4 : null; // assume 4/4

  // --- STYLE lego: the Suno style-prompt bank, pre-written ---
  // Some profiles store mood/genre as arrays; normalize scalar text fields to
  // strings so the compiler can render them without type-guarding everywhere.
  const asText = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : (v ?? null));
  const style = {
    styleSentence: asText(idn.styleSentence),
    genre: asText(idn.genre),
    subGenres: Array.isArray(idn.subGenres) ? idn.subGenres : (idn.subGenres ? [idn.subGenres] : []),
    mood: asText(idn.mood),
    vocalStyle: asText(idn.vocalStyle),
    energy: idn.energy ?? null,
    language: idn.language ?? null,
    bpm: bpm != null ? Math.round(bpm) : null,
    bpmExact: bpm,
    key: key.key ?? null,
    mode: key.mode ?? null,
    keyConfidence: key.confidence ?? null,
    palette: profile.cover?.palette ?? [],
  };

  // --- SECTION legos: chopped lyrics, normalized, time-aligned ---
  const parsed = parseSections(idn && profile.lyrics ? profile.lyrics.text : null);
  alignSections(parsed, aligned?.words);
  const sections = parsed.map((s, i) => {
    const kind = classifyKind(s.raw);
    const next = parsed[i + 1];
    const endT = next?.startT ?? (i === parsed.length - 1 ? duration : null);
    const bars = s.startT != null && endT != null && secPerBar
      ? Math.max(1, Math.round((endT - s.startT) / secPerBar))
      : null;
    return {
      i,
      id: `${id}::${kind}${ordinal(s.raw) ? '-' + ordinal(s.raw) : ''}::${i}`,
      kind,
      ordinal: ordinal(s.raw),
      voice: classifyVoice(s.raw),
      raw: s.raw,
      text: s.lines.join('\n'),
      lines: s.lines.length,
      startT: s.startT,
      endT: round2(endT),
      bars,
    };
  });

  // --- SIGNATURE legos: the song's visual DNA, straight from the lexicon reel ---
  // Dedupe by word (the reel repeats hero words), keep first/best hit for each.
  const seenWords = new Set();
  const signature = (lexicon?.reel || [])
    .filter((r) => r.featured)
    .filter((r) => (seenWords.has(r.word) ? false : (seenWords.add(r.word), true)))
    .slice(0, 8)
    .map((r) => ({ word: r.word, img: r.img, line: r.line, t: r.t, recipe: r.recipe }));

  return {
    v: LEGO_V,
    id,
    title: idn.title ?? id,
    artist: guessArtist(id),
    generatedAt: profile.generatedAt ?? null,
    duration,
    style,
    sections,
    signature,
    // compile hints: which kinds this song can donate, for fast socket filtering
    provides: [...new Set(sections.map((s) => s.kind))].sort(),
  };
}

// ---------- io ------------------------------------------------------------

function readJSON(p) {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; }
  catch (e) { console.warn(`  ! parse fail ${p}: ${e.message}`); return null; }
}

function main() {
  const only = process.argv[2];
  const dirs = readdirSync(PROFILES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => !only || id === only)
    .sort();

  const pubSongs = join(PUBLIC, 'songs');
  if (!only) { mkdirSync(pubSongs, { recursive: true }); }
  const catalog = [];
  let built = 0, skipped = 0;
  for (const id of dirs) {
    const dir = join(PROFILES, id);
    const legos = buildLegos(dir, id);
    if (!legos) { skipped++; continue; }
    writeFileSync(join(dir, 'song-legos.json'), JSON.stringify(legos, null, 2));
    if (!only) writeFileSync(join(pubSongs, `${id}.json`), JSON.stringify(legos));
    built++;
    catalog.push({
      id: legos.id,
      title: legos.title,
      artist: legos.artist,
      bpm: legos.style.bpm,
      key: legos.style.key,
      mode: legos.style.mode,
      genre: legos.style.genre,
      language: legos.style.language,
      provides: legos.provides,
      sectionCount: legos.sections.length,
      signature: legos.signature.slice(0, 4).map((s) => s.word),
      palette: legos.style.palette.slice(0, 5),
    });
    if (only) console.log(JSON.stringify(legos, null, 2));
  }

  if (!only) {
    const catalogDoc = { v: LEGO_V, generatedAt: null, count: catalog.length, songs: catalog };
    writeFileSync(join(HERE, 'legos-catalog.json'), JSON.stringify(catalogDoc, null, 2));
    writeFileSync(join(PUBLIC, 'catalog.json'), JSON.stringify(catalogDoc));
  }
  console.log(`\nlegos: built ${built}, skipped ${skipped}${only ? '' : `, catalog -> scripts/song-analysis/legos-catalog.json`}`);
}

main();

#!/usr/bin/env node
// analyzer-bundle.mjs — feedstock for THE LISTENING ROOM (/listen).
// Packs everything ultimate.mjs already measured into ONE per-song JSON the
// browser can draw: stem energy envelopes, drum onsets, the drama map, the
// melodic contour, sections, and the identity plate. Pure transform — measures
// nothing new. Sibling of legos.mjs.
//
//   node scripts/song-analysis/analyzer-bundle.mjs            # all songs
//   node scripts/song-analysis/analyzer-bundle.mjs <slug>     # one, prints summary
//
// Emits: public/analyzer/<slug>.json  +  public/analyzer/index.json
//
// Design note: envelopes stay full-resolution (0-99 ints @ envHz). ~8x3800
// ints/song gzips small and lets the page zoom without a refetch.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const V = 1;
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PROFILES = join(HERE, 'profiles');
const STEMS_OUT = join(REPO, 'scripts', 'stem-analysis', 'out');
const PUBLIC = join(REPO, 'public', 'analyzer');

// Canonical lane order, top→bottom: rhythm, low, harmonic, voice.
// Position carries stem identity (each lane is labeled); color carries family.
const STEM_ORDER = ['drums', 'perc', 'bass', 'guitar', 'keys', 'synth', 'strings', 'brass', 'woodwinds', 'other', 'lead', 'back'];
const FAMILY = {
  drums: 'rhythm', perc: 'rhythm',
  bass: 'low',
  guitar: 'harmonic', keys: 'harmonic', synth: 'harmonic', strings: 'harmonic',
  brass: 'harmonic', woodwinds: 'harmonic', other: 'harmonic',
  lead: 'voice', back: 'voice',
};

const readJSON = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch { return null; } };
const r2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : null);
const asText = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : typeof v === 'string' ? v : null);

function buildOne(id) {
  const dir = join(PROFILES, id);
  const profile = readJSON(join(dir, 'profile.json'));
  if (!profile) return null;
  const senses = readJSON(join(dir, 'senses.json'));
  const melodyRaw = readJSON(join(STEMS_OUT, id, 'melody.json'));

  const idn = profile.identity || {};
  const mix = profile.mixFeatures || {};
  const key = mix.keyEstimate || mix.key || {};
  const show = profile.show || {};
  const analysis = profile.analysis || {};
  const duration = profile.measured?.duration ?? senses?.duration ?? null;

  // ── stem lanes (the hero visual) ──────────────────────────────────────────
  const envObj = senses?.env && typeof senses.env === 'object' ? senses.env : {};
  const present = Object.keys(envObj).filter((k) => Array.isArray(envObj[k]) && envObj[k].length);
  const stems = present
    .sort((a, b) => {
      const ia = STEM_ORDER.indexOf(a), ib = STEM_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map((name) => {
      const env = envObj[name].map((n) => Math.max(0, Math.min(99, Math.round(n))));
      const peak = env.reduce((a, b) => (b > a ? b : a), 0);
      // active = fraction of the song this stem is audible at all
      const active = env.length ? env.filter((n) => n > 3).length / env.length : 0;
      return { name, family: FAMILY[name] || 'harmonic', peak, active: Math.round(active * 100), env };
    });

  // ── sections: LLM read, with ends filled from the next start ──────────────
  const rawSecs = Array.isArray(analysis.sections) ? analysis.sections : [];
  const sections = rawSecs.map((s, i) => {
    const start = r2(s.start ?? 0);
    const end = r2(rawSecs[i + 1]?.start ?? duration);
    return {
      name: s.name ?? `Section ${i + 1}`,
      start, end,
      intensity: typeof s.intensity === 'number' ? s.intensity : null,
      emotion: s.emotion ?? null,
      colorHint: s.colorHint ?? null,
    };
  });

  // ── melody: pitch per sung word ───────────────────────────────────────────
  const melody = melodyRaw?.words?.length
    ? {
        key: melodyRaw.key ?? null,
        words: melodyRaw.words
          .filter((w) => typeof w.midi === 'number' && typeof w.t === 'number')
          .map((w) => ({ t: r2(w.t), midi: r2(w.midi), conf: r2(w.conf ?? 0) })),
      }
    : null;

  const onsets = {
    beats: (senses?.beats ?? []).map(r2),
    kicks: (senses?.kicks ?? []).map(r2),
    snares: (senses?.snares ?? []).map(r2),
    hats: (senses?.hats ?? []).map(r2),
  };

  // ── stem coverage (honesty guard) ─────────────────────────────────────────
  // The env arrays are always padded to the full duration, but the analysed
  // stem audio frequently stops early (median ~64% of the song across the
  // catalog). Past `stemsTo` we have NO measurement — that is not silence, and
  // the room must not draw it as silence.
  const envHz = senses?.envHz ?? 12.5;
  let lastAudible = -1;
  for (const s of stems) {
    for (let i = s.env.length - 1; i > lastAudible; i--) {
      if (s.env[i] > 3) { lastAudible = i; break; }
    }
  }
  const stemsTo = lastAudible >= 0 ? r2(lastAudible / envHz) : null;
  const coverage = stemsTo != null && duration ? Math.min(1, stemsTo / duration) : null;

  return {
    v: V,
    id,
    title: idn.title ?? id,
    duration,
    envHz: senses?.envHz ?? 12.5,
    identity: {
      bpm: profile.measured?.bpm ? Math.round(profile.measured.bpm) : null,
      bpmExact: r2(profile.measured?.bpm),
      key: key.key ?? null,
      mode: key.mode ?? null,
      keyConf: r2(key.confidence),
      genre: asText(idn.genre),
      subGenres: Array.isArray(idn.subGenres) ? idn.subGenres : [],
      mood: asText(idn.mood),
      energy: asText(idn.energy),
      language: asText(idn.language),
      vocalStyle: asText(idn.vocalStyle),
      styleSentence: asText(idn.styleSentence),
      summary: asText(analysis.summary),
      themes: Array.isArray(analysis.themes) ? analysis.themes : [],
      keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
    },
    tone: { brightness: r2(mix.brightness), dynamicsDb: r2(mix.dynamicsDb) },
    palette: profile.cover?.palette ?? analysis.palette ?? [],
    boundaries: (mix.boundaries ?? []).map(r2),
    sections,
    stems,
    onsets,
    drama: { cuts: show.dropMap?.cuts ?? [], risers: show.dropMap?.risers ?? [] },
    arc: show.energyArc ?? null,
    sectionEnergy: show.sectionEnergy ?? null,
    vocalPresence: show.vocalPresence ?? null,
    melody,
    // How far the stem analysis actually reaches, and how much of the song
    // that is. coverage < ~0.9 means the tail is unmeasured, not quiet.
    stemsTo,
    coverage: coverage != null ? Math.round(coverage * 1000) / 1000 : null,
    // Honest coverage — the page renders a layer only if its flag is true.
    has: {
      stems: stems.length > 0,
      melody: !!melody,
      onsets: onsets.beats.length > 0,
      sections: sections.length > 0,
      drama: (show.dropMap?.cuts?.length ?? 0) > 0 || (show.dropMap?.risers?.length ?? 0) > 0,
    },
  };
}

function main() {
  const only = process.argv[2];
  mkdirSync(PUBLIC, { recursive: true });
  const ids = readdirSync(PROFILES, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name)
    .filter((id) => !only || id === only).sort();

  const index = [];
  let built = 0, skipped = 0, bytes = 0;
  for (const id of ids) {
    const bundle = buildOne(id);
    if (!bundle) { skipped++; continue; }
    const json = JSON.stringify(bundle);
    writeFileSync(join(PUBLIC, `${id}.json`), json);
    bytes += json.length;
    built++;
    index.push({
      id, title: bundle.title, duration: bundle.duration,
      bpm: bundle.identity.bpm, key: bundle.identity.key, mode: bundle.identity.mode,
      genre: bundle.identity.genre, palette: bundle.palette.slice(0, 5),
      stemCount: bundle.stems.length, has: bundle.has, coverage: bundle.coverage,
    });
    if (only) {
      console.log(`${id}: ${bundle.stems.length} stems [${bundle.stems.map((s) => s.name).join(', ')}]`);
      console.log(`  sections ${bundle.sections.length} · beats ${bundle.onsets.beats.length} · kicks ${bundle.onsets.kicks.length} · melody ${bundle.melody?.words.length ?? 0} words`);
      console.log(`  coverage ${JSON.stringify(bundle.has)}`);
      console.log(`  ${(json.length / 1024).toFixed(0)} KB`);
    }
  }
  if (!only) {
    writeFileSync(join(PUBLIC, 'index.json'), JSON.stringify({ v: V, count: index.length, songs: index }));
    console.log(`analyzer: built ${built}, skipped ${skipped}, avg ${(bytes / built / 1024).toFixed(0)} KB/song → public/analyzer/`);
  }
}

main();

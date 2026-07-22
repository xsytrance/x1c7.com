#!/usr/bin/env node
// splice.mjs — the Splice Table EASY mode (spoonfeed-first law).
// Give it two songs; it auto-picks compatible sections, auto-builds a flow, and
// compiles a paste-ready Suno prompt with ZERO hand-authoring. The generated flow is
// written to disk so you can open it in PRO mode (edit compile.mjs flows) and tweak.
//
//   node scripts/song-analysis/splice.mjs <styleSong> <guestSong>
//   node scripts/song-analysis/splice.mjs cocktails-and-code jayodeed-going-crazy-rooklyn-mix
//
// Policy: styleSong drives tempo/key/genre and donates the skeleton (intro, verses,
// outro); guestSong brings the earworm (its fullest hook/chorus). Both songs always
// appear. Missing section kinds are skipped, never faked.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSong, compile, render, HERE } from './compile.mjs';

// ---------- section picking ----------------------------------------------

// Interchangeable kinds when a slot's first choice is missing.
const ALIASES = { chorus: ['chorus', 'hook'], hook: ['hook', 'chorus'] };

function sectionsOfKind(song, kind) {
  const kinds = ALIASES[kind] || [kind];
  return song.sections.filter((s) => kinds.includes(s.kind));
}

// The "fullest" section of a kind = the most-developed take (most lines). That's the
// definitive hook, not a 2-bar reprise.
function fullest(song, kind) {
  const cands = sectionsOfKind(song, kind);
  if (!cands.length) return null;
  return cands.slice().sort((a, b) => b.lines - a.lines)[0];
}

// The Nth section of a kind by song order (verse 1, verse 2, ...).
function nth(song, kind, n) {
  const cands = sectionsOfKind(song, kind);
  return cands[n] || null;
}

// ---------- auto-arrangement ---------------------------------------------

function autoArrange(style, guest) {
  const plan = [];      // { ref, as, why }
  const add = (song, sec, as, why) => { if (sec) { plan.push({ ref: sec.id, as, why }); return true; } return false; };

  // intro — style skeleton
  add(style, fullest(style, 'intro') || nth(style, 'intro', 0), 'intro',
    `intro from ${style.id} (skeleton)`);

  // verse 1 — style
  add(style, nth(style, 'verse', 0), 'verse', `verse 1 from ${style.id}`);

  // pre-chorus — style, if it has one (leads naturally into the guest hook)
  add(style, fullest(style, 'prechorus'), 'prechorus', `pre-chorus from ${style.id} (lead-in)`);

  // CHORUS — the guest's earworm (the whole point of the mash)
  let hook = fullest(guest, 'chorus');
  if (hook) add(guest, hook, 'chorus', `HOOK from ${guest.id} (guest earworm)`);
  else {
    // guest has no chorus/hook — feature its fullest verse instead, keep style's chorus
    add(style, fullest(style, 'chorus'), 'chorus', `chorus from ${style.id} (guest had none)`);
    add(guest, fullest(guest, 'verse'), 'verse', `featured verse from ${guest.id} (no hook to borrow)`);
  }

  // verse 2 — style's 2nd verse, else borrow guest's
  add(style, nth(style, 'verse', 1), 'verse', `verse 2 from ${style.id}`)
    || add(guest, nth(guest, 'verse', 1) || nth(guest, 'verse', 0), 'verse', `verse 2 borrowed from ${guest.id}`);

  // bridge — prefer the guest's bridge for variety; else style's
  const bridge = fullest(guest, 'bridge') || fullest(style, 'bridge');
  if (bridge) {
    const from = fullest(guest, 'bridge') ? guest : style;
    add(from, bridge, 'bridge', `bridge from ${from.id} (variety)`);
  }

  // final chorus — reprise the guest hook
  if (hook) add(guest, hook, 'chorus', `hook reprise from ${guest.id}`);

  // outro — style skeleton
  add(style, fullest(style, 'outro') || nth(style, 'outro', 0), 'outro',
    `outro from ${style.id} (resolve)`);

  return plan;
}

// ---------- main ----------------------------------------------------------

function main() {
  const [styleId, guestId] = process.argv.slice(2);
  if (!styleId || !guestId) {
    console.error('usage: node splice.mjs <styleSong> <guestSong>');
    console.error('  e.g. node splice.mjs cocktails-and-code jayodeed-going-crazy-rooklyn-mix');
    process.exit(1);
  }

  let style, guest;
  try { style = loadSong(styleId); guest = loadSong(guestId); }
  catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }

  const plan = autoArrange(style, guest);
  if (!plan.length) { console.error('✗ could not build an arrangement (no usable sections)'); process.exit(1); }

  // EASY-mode defaults: modest weirdness, high style adherence, auto voice.
  const flow = {
    title: null,
    style: { from: styleId, overrides: {} },
    arrangement: plan.map(({ ref, as }) => ({ ref, as })),
    knobs: { weirdness: 25, styleStrength: 70, audioInfluence: 0, voice: 'auto' },
    exclude: ['harsh autotune'],
  };

  const out = compile(flow);

  // Show the machine's reasoning first — spoonfeed, but transparent.
  console.log(`\n  🥄  EASY SPLICE   ${style.title}  ✕  ${guest.title}`);
  console.log(`      style base: ${styleId} (${style.style.bpm} BPM, ${style.style.key} ${style.style.mode})`);
  console.log(`      guest:      ${guestId} (${guest.style.bpm} BPM, ${guest.style.key} ${guest.style.mode})`);
  console.log(`\n  AUTO-ARRANGEMENT`);
  for (const p of plan) console.log(`    ${(p.as).padEnd(10)} ← ${p.why}`);
  console.log('');
  console.log(render(out));

  // Write the generated flow for PRO-mode editing (EASY → PRO handoff).
  const slug = `${styleId}__x__${guestId}`;
  const flowPath = join(HERE, `flows`, `${slug}.flow.json`);
  try {
    // flows/ may not exist yet; write beside compile.mjs instead if mkdir isn't desired
    writeFileSync(join(HERE, `${slug}.flow.json`), JSON.stringify(flow, null, 2));
    console.log(`\n  editable flow (PRO mode) -> scripts/song-analysis/${slug}.flow.json`);
    console.log(`  tweak it, then: node scripts/song-analysis/compile.mjs scripts/song-analysis/${slug}.flow.json`);
  } catch (e) { console.warn(`  (couldn't write flow: ${e.message})`); }
}

main();

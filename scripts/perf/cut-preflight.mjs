#!/usr/bin/env node
// CUT PREFLIGHT — refuse to render a directed cut whose data is quietly broken.
//
// Written after a 59s cut shipped where every visual was deaf to the music: the
// song's stems.json had been truncated by the old libsndfile bug and carried
// ZERO energy past 169.9s, so across the whole window every word got the
// minimum "delivery" size and the backdrop, particles and riser charge received
// nothing. The render rig reported perfect A/V sync the entire time, because
// frame↔audio sync was never the thing that was wrong.
//
// The rig proves the video matches the audio. This proves the DATA matches the
// song. Run it before every render.
//
//   node scripts/perf/cut-preflight.mjs --track <slug> --from S --to S
//
// Exit 1 on any FAIL. --warn-only downgrades failures to warnings.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const TRACK = args.track, FROM = parseFloat(args.from), TO = parseFloat(args.to);
if (!TRACK || !isFinite(FROM) || !isFinite(TO)) {
  console.error("usage: cut-preflight.mjs --track <slug> --from <sec> --to <sec>"); process.exit(2);
}

const fails = [], warns = [], oks = [];
const FAIL = (m) => fails.push(m), WARN = (m) => warns.push(m), OK = (m) => oks.push(m);

const { data: row, error } = await db.from("tracks").select("planet,lyrics_synced,audio_url").eq("id", TRACK).single();
if (error) { console.error(error); process.exit(1); }
const planet = row.planet ?? {};
const dp = planet.dynamicPlus ?? {};
const words = (row.lyrics_synced?.words ?? []).filter((w) => w.t >= FROM && w.t <= TO);

// ── 1. Words exist and are dense enough to carry a lyric video ─────────────
if (!words.length) FAIL("no lyrics_synced words inside the window");
else OK(`${words.length} words in window (${(words.length / (TO - FROM) * 60).toFixed(0)}/min)`);

// ── 1b. THE SECOND ONE THAT BIT US — words must SPAN the window, not just
// exist in it. A cut shipped where the first 24.5s (41% of the video) had no
// lyric at all: the window had been moved earlier without rebuilding the
// alignment, so every word sat in the back half and the stage fell back to the
// title card for the whole opening. The total-count check above passed
// happily — 83 words looked healthy. Density is not coverage. Measure the
// silence: the lead-in before the first word, the tail after the last, and the
// widest hole between any two.
if (words.length) {
  const HOLE = 6;   // seconds of dead air a viewer reads as "it's broken"
  const lead = words[0].t - FROM;
  const tail = TO - words[words.length - 1].t;
  let gap = 0, gapAt = 0;
  for (let i = 1; i < words.length; i++) {
    const g = words[i].t - words[i - 1].t;
    if (g > gap) { gap = g; gapAt = words[i - 1].t; }
  }
  const say = (label, secs, at) =>
    `${label} ${secs.toFixed(1)}s${at != null ? ` at ${at.toFixed(2)}` : ""} (${(secs / (TO - FROM) * 100).toFixed(0)}% of the cut)`;
  if (lead > HOLE) FAIL(say("DEAD AIR before the first word:", lead) + " — the window very likely moved without rebuilding aligned.json");
  else OK(`lead-in ${lead.toFixed(1)}s`);
  if (tail > HOLE) FAIL(say("DEAD AIR after the last word:", tail));
  else OK(`tail ${tail.toFixed(1)}s`);
  if (gap > HOLE) FAIL(say("DEAD AIR mid-window:", gap, gapAt));
  else OK(`largest mid-window gap ${gap.toFixed(1)}s`);
}

// ── 2. THE ONE THAT BIT US — stem energy across the whole window ───────────
// The engine scales word size by measured lead-vocal energy and drives the
// backdrop off the same envelopes. A window sitting past the end of the data
// renders flat and lifeless while every other check still passes.
const sensesPath = join(REPO, "scripts/song-analysis/profiles", TRACK, "senses.json");
if (!existsSync(sensesPath)) WARN("no local senses.json — cannot verify stem coverage");
else {
  const s = JSON.parse(readFileSync(sensesPath, "utf8"));
  const hz = s.envHz || 12.5;
  const lead = s.env?.lead ?? [];
  const a = Math.floor(FROM * hz), b = Math.ceil(TO * hz);
  const slice = lead.slice(a, b);
  const live = slice.filter((v) => v > 1e-6).length;
  const cov = slice.length ? live / slice.length : 0;
  if (!slice.length) FAIL(`stem envelope ends at ${(lead.length / hz).toFixed(1)}s — the window has NO data at all`);
  else if (cov < 0.5) FAIL(`lead envelope is dead across ${((1 - cov) * 100).toFixed(0)}% of the window (coverage ${cov.toFixed(2)}) — words will render at minimum size and the backdrop will not react. Re-run analyze_audio.py and re-publish stems.json.`);
  else if (cov < 0.85) WARN(`lead envelope coverage only ${cov.toFixed(2)} across the window`);
  else OK(`lead envelope coverage ${cov.toFixed(2)} across the window`);

  // Tempo octave: librosa's audio-only path often locks onto the 8th grid.
  if (s.bpm && (s.bpm > 165 || s.bpm < 55)) WARN(`bpm ${s.bpm} looks like an octave error — the stage will pulse at the wrong rate`);
  else if (s.bpm) OK(`bpm ${s.bpm}`);
}

// ── 3. Section intensity — 0.72+ synthesises a shake banner over the frame ──
const hot = (planet.analysis?.sections ?? []).filter((x) => x.intensity > 0.71 && x.start >= FROM - 40 && x.start <= TO);
if (hot.length) FAIL(`section intensity >0.71 inside/near the window (${hot.map((x) => `${x.start}=${x.intensity}`).join(", ")}) — spawns a shake banner`);
else OK("section intensities <= 0.71");

// ── 4. Interaction moments — these throw a prompt banner over the cut ───────
const clash = (planet.interactions?.moments ?? []).filter((m) => m.end > FROM && m.t < TO);
if (clash.length) FAIL(`${clash.length} interaction moment(s) overlap the window: ${clash.map((m) => `${m.t}-${m.end} ${m.type}`).join(", ")}`);
else OK("no interaction moments overlap");

// ── 5. Mode windows: too short to be seen, or cutting a word in half ───────
const modes = dp.modes ?? [];
const inWin = modes.filter((m) => m.end > FROM && m.start < TO);
for (const m of inWin) {
  // The conductor polls at 80ms; anything under ~0.25s is a coin flip.
  if (m.end - m.start < 0.25) FAIL(`mode window ${m.start}-${m.end} (${m.mode}) is ${(m.end - m.start).toFixed(2)}s — too short for the conductor to see`);
  // A boundary sitting just BEFORE a word starts is the ideal case: that word
  // is born into the new mode. What hurts is a boundary landing INSIDE a word's
  // airtime, which re-renders it mid-entrance and makes it stutter. Only flag
  // the second kind.
  for (const b of [m.start, m.end]) {
    // The window edges are render bounds, not switches — nothing re-renders there.
    if (Math.abs(b - FROM) < 0.02 || Math.abs(b - TO) < 0.02) continue;
    const prev = [...words].reverse().find((w) => w.t <= b);
    const next = words.find((w) => w.t > b);
    if (!prev) continue;
    const sincePrev = b - prev.t;
    const tilNext = next ? next.t - b : Infinity;
    if (sincePrev > 0.03 && sincePrev < 0.45 && tilNext > 0.12) {
      WARN(`mode boundary ${b} lands ${sincePrev.toFixed(2)}s INTO "${prev.w}" — that word re-renders mid-entrance`);
    }
  }
}
if (inWin.length) OK(`${inWin.length} mode windows, ${inWin.filter((m) => m.mode === "dynamic").length} dynamic`);

// ── 6a. Effects that make a lyric unreadable ───────────────────────────────
// `redact` draws a solid near-black bar OVER the word — it is a censorship
// effect, not a reveal. On a lyric video it renders the line unreadable.
const fx = { ...(planet.effects?.overrides ?? {}), ...(dp.words ?? {}) };
const redacted = Object.entries(fx).filter(([, e]) => e === "redact").map(([w]) => w);
const sungRedacted = redacted.filter((w) => words.some((x) => String(x.w).toLowerCase().replace(/[^a-z0-9]/g, "") === w));
if (sungRedacted.length) FAIL(`redact is mapped to word(s) sung inside the window (${sungRedacted.join(", ")}) — redact paints a black bar over the word and it cannot be read`);
else if (redacted.length) OK(`redact mapped only to words not sung in this window`);

// ── 6b. Word colours must all be legible ───────────────────────────────────
const lum = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
};
const dark = (planet.analysis?.palette ?? []).filter((c) => lum(c) < 0.25);
if (dark.length) FAIL(`palette contains near-black entries (${dark.join(", ")}) — the engine draws words from this array, so roughly one word in ${Math.round((planet.analysis.palette.length) / dark.length)} renders invisible`);
else OK(`palette ${(planet.analysis?.palette ?? []).length} colours, all legible`);

// ── 7. Audio the renderer will actually use ────────────────────────────────
const mp3 = join(REPO, "scripts/song-analysis/profiles", TRACK, "release.mp3");
if (!existsSync(mp3)) FAIL(`no release.mp3 in the profile — render-cut.mjs will fail`);
else OK("release.mp3 present");

// ── report ────────────────────────────────────────────────────────────────
console.log(`\nPREFLIGHT  ${TRACK}  ${FROM} → ${TO}  (${(TO - FROM).toFixed(1)}s)\n`);
for (const m of oks) console.log(`  ok    ${m}`);
for (const m of warns) console.log(`  WARN  ${m}`);
for (const m of fails) console.log(`  FAIL  ${m}`);
console.log(`\n${fails.length ? `✗ ${fails.length} FAILURE(S)` : "✓ all checks passed"}${warns.length ? ` · ${warns.length} warning(s)` : ""}\n`);
process.exit(fails.length && !args["warn-only"] ? 1 : 0);

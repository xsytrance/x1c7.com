#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RELEASE THE ENGINE → KINETICA
//
// x1c7 is the workshop; Kinetica is the gift box. They ship the SAME lyric
// engine. You build here, then run this to copy the engine into Kinetica —
// every new build, one command. Only the engine crosses over; each app keeps
// its own shell (x1c7's website, Kinetica's stem-zip ingest / AI / Tauri).
//
// What makes this safe:
//   • The engine is app-agnostic except ONE file per app: src/lib/engineHost.ts
//     (useMusicPlayer + Track + HAS_SHARED_ART). This script NEVER overwrites
//     Kinetica's host — it scaffolds one if missing, then leaves it alone.
//   • x1c7 keeps engine components in src/components/; Kinetica keeps them in
//     src/engine/. The path map + a tiny import rewrite handle that.
//   • Dry-run by default. Nothing is written without --apply.
//   • A lint pass warns if any engine file smuggled in an app-coupled import
//     (next/…, @/data/tracks, ./MusicPlayerContext) that would break Kinetica.
//
// Usage:
//   node scripts/engine/sync-to-kinetica.mjs                 # dry-run (default)
//   node scripts/engine/sync-to-kinetica.mjs --apply         # write it
//   node scripts/engine/sync-to-kinetica.mjs --target /path/to/kinetica --apply
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const ti = args.indexOf("--target");
const TARGET = path.resolve(ti >= 0 ? args[ti + 1] : "/home/xsyprime/kinetica");

// ── The engine: [ x1c7 path, Kinetica path ]. Same path unless noted. ────────
const FILES = [
  ["src/components/KineticStage.tsx", "src/engine/KineticStage.tsx"],
  ["src/components/KineticParticles.tsx", "src/engine/KineticParticles.tsx"],
  ["src/components/SurfaceEffects.tsx", "src/engine/SurfaceEffects.tsx"],
  ["src/components/PerfHUD.tsx", "src/engine/PerfHUD.tsx"],
  ["src/lib/perf.ts", "src/lib/perf.ts"],
  ["src/lib/effects/registry.ts", "src/lib/effects/registry.ts"],
  ["src/lib/planet.ts", "src/lib/planet.ts"],
  ["src/lib/lyrics.ts", "src/lib/lyrics.ts"],
  ["src/lib/shapes.ts", "src/lib/shapes.ts"],
  ["src/lib/theme.ts", "src/lib/theme.ts"],
  // Cover-art → palette extraction, so both apps can auto-theme from a dropped
  // cover image. Only imports ./theme (also synced); no app coupling.
  ["src/lib/palette.ts", "src/lib/palette.ts"],
  ["src/lib/stemSense.ts", "src/lib/stemSense.ts"],
  // The live stem-mix store (KineticStage reads visualGain per frame). Pure
  // module store + react hook; the audio engine that drives it stays per-app.
  ["src/lib/stemMix.ts", "src/lib/stemMix.ts"],
  ["src/lib/beatClock.ts", "src/lib/beatClock.ts"],
  // The PRISM-inspired engine core: param registry, ground-truth feature bus,
  // beat-synced LFOs + stem-follow modulators, WebGL2 layer, and the living
  // generative backdrop. Engine-pure: they import only each other + stemSense/
  // planet/beatClock (all synced above).
  ["src/lib/engine/params.ts", "src/lib/engine/params.ts"],
  ["src/lib/engine/features.ts", "src/lib/engine/features.ts"],
  ["src/lib/engine/lfo.ts", "src/lib/engine/lfo.ts"],
  ["src/lib/engine/gl.ts", "src/lib/engine/gl.ts"],
  ["src/lib/engine/backdrop.ts", "src/lib/engine/backdrop.ts"],
  ["src/components/KineticBackdrop.tsx", "src/engine/KineticBackdrop.tsx"],
  ["src/lib/lexicon/types.ts", "src/lib/lexicon/types.ts"],
  ["src/lib/lexicon/lookup.ts", "src/lib/lexicon/lookup.ts"],
  // The pre-grown shelf travels as data (until it's hosted — see Phase D).
  ["src/data/lexicon.json", "src/data/lexicon.json"],
];

// x1c7 components live in src/components/, Kinetica's in src/engine/. Rewrite the
// only cross-dir alias (registry → KineticParticles). Relative `./` imports and
// `@/lib/*` already resolve the same in both repos, so they need no change.
const REWRITES = [[/@\/components\//g, "@/engine/"]];

// Kinetica's own host — scaffolded once, then never touched by the sync.
const KINETICA_HOST_PATH = "src/lib/engineHost.ts";
const KINETICA_HOST = `// ═══════════════════════════════════════════════════════════════════════════
// ENGINE HOST — the adapter seam (Kinetica side).
//
// The lyric engine is synced from x1c7 by scripts/engine/sync-to-kinetica.mjs.
// This is the ONE file it imports that differs per app. The sync scaffolds it
// once and never overwrites it. Keep it to these three exports.
// ═══════════════════════════════════════════════════════════════════════════

export { useMusicPlayer } from "@/audio/player";
export type { Track } from "@/lib/types";

/** Kinetica has no shared cross-song art library; song art comes from the planet. */
export const HAS_SHARED_ART = false;

/** Kinetica's art is local/generated (blob URLs), not under /planets/ — no prefix. */
export const PLANET_BASE = "";
`;

// Imports that must NOT appear in a synced engine file (would break Kinetica).
const FORBIDDEN = [
  [/from ["']next\//, "next/* import (Kinetica is Vite, not Next)"],
  [/from ["']@\/data\/tracks["']/, "@/data/tracks (use @/lib/engineHost for Track)"],
  [/from ["']\.\/MusicPlayerContext["']/, "./MusicPlayerContext (use @/lib/engineHost)"],
  [/@\/components\//, "unrewritten @/components/ path"],
];

function rewrite(content, dst) {
  if (dst.endsWith(".json")) return content;
  let out = content;
  for (const [re, to] of REWRITES) out = out.replace(re, to);
  return out;
}

function lintSynced(content, dst) {
  if (dst.endsWith(".json")) return [];
  return FORBIDDEN.filter(([re]) => re.test(content)).map(([, msg]) => msg);
}

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

function main() {
  if (!fs.existsSync(TARGET)) { console.error(`✗ target not found: ${TARGET}`); process.exit(1); }
  if (!isGitRepo(TARGET) && !FORCE) {
    console.error(`✗ ${TARGET} is not a git repo. Refusing to write (use --force to override).`);
    process.exit(1);
  }

  console.log(`engine sync  ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`  from  ${SRC_ROOT}`);
  console.log(`  to    ${TARGET}\n`);

  let changed = 0, created = 0, same = 0, warnings = 0;
  for (const [srcRel, dstRel] of FILES) {
    const srcPath = path.join(SRC_ROOT, srcRel);
    const dstPath = path.join(TARGET, dstRel);
    if (!fs.existsSync(srcPath)) { console.log(`  ⚠ MISSING SOURCE  ${srcRel}`); warnings++; continue; }
    const next = rewrite(fs.readFileSync(srcPath, "utf8"), dstRel);

    // Guard: never ship an engine file that reaches into an app.
    const smells = lintSynced(next, dstRel);
    for (const s of smells) { console.log(`  ⚠ COUPLING  ${dstRel}: ${s}`); warnings++; }

    const exists = fs.existsSync(dstPath);
    const prev = exists ? fs.readFileSync(dstPath, "utf8") : null;
    const state = !exists ? "NEW" : prev === next ? "SAME" : "CHANGED";
    if (state === "SAME") { same++; continue; }
    if (state === "NEW") created++; else changed++;

    const arrow = srcRel === dstRel ? dstRel : `${srcRel} → ${dstRel}`;
    console.log(`  ${state === "NEW" ? "+ NEW    " : "~ CHANGED"}  ${arrow}`);
    if (APPLY) { fs.mkdirSync(path.dirname(dstPath), { recursive: true }); fs.writeFileSync(dstPath, next); }
  }

  // Scaffold the Kinetica host once (never overwrite).
  const hostPath = path.join(TARGET, KINETICA_HOST_PATH);
  if (!fs.existsSync(hostPath)) {
    console.log(`  + HOST     ${KINETICA_HOST_PATH}  (scaffolded — edit if Kinetica's player/types move)`);
    created++;
    if (APPLY) { fs.mkdirSync(path.dirname(hostPath), { recursive: true }); fs.writeFileSync(hostPath, KINETICA_HOST); }
  }

  console.log(`\n  ${changed} changed · ${created} new · ${same} unchanged · ${warnings} warning(s)`);
  if (!APPLY) {
    console.log(`\n  dry-run only — nothing written. Re-run with --apply to release.`);
  } else {
    console.log(`\n  ✦ released. Next:`);
    console.log(`      cd ${TARGET} && npm run build   # verify it compiles`);
    console.log(`      git switch -c engine-sync && git add -A && git commit   # review + ship`);
  }
  if (warnings > 0) process.exitCode = 2;
}

main();

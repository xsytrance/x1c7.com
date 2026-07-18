#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CASE-ENGINE PARITY GUARD (Pressing Plant P1) — proves that refactors of
// src/lib/collector/webEngine.ts change NOTHING. Bundles webEngine for node
// (esbuild, "@/" aliased to src/), runs buildOverlaySVG over fixture CaseSpecs,
// and compares the exact SVG strings against the committed baseline.
//
//   node scripts/press/check-parity.mjs            # compare against baseline
//   node scripts/press/check-parity.mjs --write    # (re)write the baseline
//
// The baseline (scripts/press/parity-baseline.json) is committed. If a change
// is INTENTIONAL (layout actually changed), re-write the baseline in the same
// commit and say so in the message. Silence is golden; diffs are failures.
// ═══════════════════════════════════════════════════════════════════════════
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const BASELINE = join(HERE, "parity-baseline.json");
const write = process.argv.includes("--write");

// Fixtures chosen to exercise every branch: subtitle split, long title shrink,
// forced palette, spine override, lang/geo/series, waveform, advisory, flags.
const FIXTURES = {
  minimal: { title: "Neon Rain", label: "MOONBYTE" },
  full: {
    title: "Another Year Looks Good On You (Happy Birthday Song)",
    genre: "Liquid DnB", spine: "DRUMS & WIRE", label: "MOONBYTE", handle: "moonbyte.wav",
    monogram: "M", lang: "EN/JP", geo: "OSAKA", series: "Night Drives",
    bpm: 174, runtime: "3:42",
    peaks: Array.from({ length: 96 }, (_, i) => +(0.2 + 0.8 * Math.abs(Math.sin(i * 1.7))).toFixed(3)),
    explicit: true, unreleased: true,
  },
  forcedPalette: { title: "Cold Sugar: The Remix", genre: "Pop", palette: "TECHNO", label: "YOUR LABEL" },
};

// Bundle webEngine for node. buildOverlaySVG is pure string math — no DOM.
const tmp = mkdtempSync(join(tmpdir(), "parity-"));
const entry = join(tmp, "entry.ts");
writeFileSync(entry, `
import { buildOverlaySVG } from "${join(ROOT, "src/lib/collector/webEngine.ts").replace(/\\/g, "/")}";
const fixtures = ${JSON.stringify(FIXTURES)};
const out = {};
for (const [k, spec] of Object.entries(fixtures)) out[k] = buildOverlaySVG(spec as never);
process.stdout.write(JSON.stringify(out));
`);
const bundle = join(tmp, "bundle.cjs");
execFileSync("npx", ["esbuild", entry, "--bundle", "--platform=node", "--format=cjs",
  `--alias:@=${join(ROOT, "src")}`, "--loader:.json=json", `--outfile=${bundle}`],
  { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
const svgs = JSON.parse(execFileSync("node", [bundle], { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
rmSync(tmp, { recursive: true, force: true });

const sha = (s) => createHash("sha256").update(s).digest("hex");
const current = Object.fromEntries(Object.entries(svgs).map(([k, v]) => [k, { sha256: sha(v), bytes: v.length }]));

if (write) {
  writeFileSync(BASELINE, JSON.stringify({ note: "buildOverlaySVG parity baseline — see check-parity.mjs", current, svgs }, null, 1));
  console.log(`✓ baseline written (${Object.keys(current).length} fixtures)`);
  process.exit(0);
}
if (!existsSync(BASELINE)) { console.error("✗ no baseline — run with --write first"); process.exit(2); }
const base = JSON.parse(readFileSync(BASELINE, "utf8"));
let fail = 0;
for (const [k, v] of Object.entries(current)) {
  const b = base.current[k];
  if (!b) { console.error(`✗ ${k}: not in baseline`); fail++; continue; }
  if (b.sha256 !== v.sha256) {
    console.error(`✗ ${k}: SVG changed (${b.bytes} → ${v.bytes} bytes)`);
    // first divergence point, for humans
    const a = base.svgs[k], c = svgs[k];
    let i = 0; while (i < Math.min(a.length, c.length) && a[i] === c[i]) i++;
    console.error(`  first diff at char ${i}: …${a.slice(Math.max(0, i - 40), i + 40)}… vs …${c.slice(Math.max(0, i - 40), i + 40)}…`);
    fail++;
  } else {
    console.log(`✓ ${k} identical`);
  }
}
process.exit(fail ? 1 : 0);

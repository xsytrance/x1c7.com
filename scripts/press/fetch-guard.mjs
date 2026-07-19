#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PRIVACY GUARD — makes the Pressing Plant's promise structural.
// FREE-tier modules must be incapable of exfiltration: no `fetch(` anywhere
// in src/lib/press/** or src/lib/collector/** except the allow-list below
// (static same-origin assets + the clearly-labeled KEYED module). Runs
// before every build (package.json), so a violation is a broken build, not
// a broken promise.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN = ["src/lib/press", "src/lib/collector"];
const ALLOW = new Set([
  "src/lib/press/kit/fonts.ts",          // GET /fonts/*.ttf — same-origin static
  "src/lib/press/analysis/aiAnalyze.ts", // KEYED/house-key — the ONLY escalation door
  "src/lib/press/seeds/lexiconSeeds.ts", // GET public lexicon.json — carries no user data
]);

let bad = 0;
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx|js|mjs)$/.test(f)) continue;
    const rel = relative(ROOT, p).replace(/\\/g, "/");
    if (ALLOW.has(rel)) continue;
    const src = readFileSync(p, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (/\bfetch\s*\(/.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        console.error(`✗ ${rel}:${i + 1} — fetch() outside the allow-list: ${line.trim().slice(0, 90)}`);
        bad++;
      }
    });
  }
};
for (const d of SCAN) { try { walk(join(ROOT, d)); } catch { /* dir may not exist yet */ } }
if (bad) { console.error(`\nprivacy guard FAILED — ${bad} disallowed fetch site(s).`); process.exit(1); }
console.log("✓ privacy guard: FREE modules are fetch-silent");

#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REALIGN · INBOX — consume the owner's corrected lyrics, end to end.
//
// For every scripts/alignment/inbox/<slug>.txt (dropped by the Studio's
// Lyrics Inbox or by hand): align the new text against the cached lead stem
// (Qwen3-ForcedAligner, GPU) → refine (onset snap/lag/clumps) → GATE (apply
// only if the refined score beats what's live) → journal + write to Supabase
// → re-run + republish melody.json for the song (word indices changed) →
// move the inbox file to inbox/done/.
//
//   node scripts/alignment/realign-inbox.mjs [--only slug] [--dry]
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const INBOX = path.join(__dirname, "inbox");
const DONE = path.join(INBOX, "done");
const STEM_OUT = path.join(ROOT, "scripts", "stem-analysis", "out");
const JOURNAL = path.join(__dirname, "refine-backup.jsonl");
const HOME = process.env.HOME || "/home/xsyprime";
const PY_ALIGN = path.join(HOME, "whisper-venv", "bin", "python");
const PY_REFINE = path.join(HOME, "librosa-venv", "bin", "python");
const R2 = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const oi = args.indexOf("--only");
const ONLY = oi >= 0 ? new Set(args[oi + 1].split(",")) : null;
const log = (...a) => console.error(...a);

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const abs = (u) => (u && !/^https?:/.test(u) ? R2 + (u.startsWith("/") ? u : `/${u}`) : u);

async function main() {
  if (!fs.existsSync(INBOX)) { log("inbox empty (no dir)"); return; }
  const files = fs.readdirSync(INBOX).filter((f) => f.endsWith(".txt"));
  const queue = files.map((f) => f.replace(/\.txt$/, "")).filter((s) => !ONLY || ONLY.has(s));
  if (!queue.length) { log("inbox empty"); return; }
  log(`inbox: ${queue.length} song(s)${DRY ? " (dry)" : ""}\n`);
  fs.mkdirSync(DONE, { recursive: true });

  const applied = [];
  for (const slug of queue) {
    log(`════ ${slug}`);
    try {
      const { data } = await db.from("tracks").select("id, lyrics_synced, planet").eq("id", slug);
      const row = data?.[0];
      if (!row) { log("  ✗ no such track"); continue; }
      const dir = path.join(STEM_OUT, slug);
      const leadUrl = abs(row.planet?.assets?.stemAudio?.lead);
      if (!leadUrl) { log("  ✗ no lead stem published"); continue; }
      const leadPath = path.join(dir, "lead" + (path.extname(new URL(leadUrl).pathname) || ".m4a"));
      fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(leadPath)) {
        const r = await fetch(leadUrl);
        fs.writeFileSync(leadPath, Buffer.from(await r.arrayBuffer()));
      }
      const stemsJson = row.planet?.assets?.stems ? await (await fetch(abs(row.planet.assets.stems))).json().catch(() => null) : null;
      const lag = stemsJson?.align?.lag ?? 0;
      // language from the profile when we have it
      let lang = "English";
      try {
        const prof = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "song-analysis", "profiles", slug, "profile.json"), "utf8"));
        lang = String(prof?.lyrics?.language || "english").replace(/^./, (c) => c.toUpperCase());
      } catch { /* default */ }

      const aligned = path.join(dir, "inbox-aligned.json");
      execFileSync(PY_ALIGN, [path.join(__dirname, "realign-one.py"),
        "--lead", leadPath, "--text", path.join(INBOX, `${slug}.txt`), "--lang", lang, "--lag", String(lag), "--out", aligned,
      ], { stdio: ["ignore", 2, 2] });
      const refined = path.join(dir, "inbox-refined.json");
      execFileSync(PY_REFINE, [path.join(__dirname, "refine-alignment.py"),
        "--lead", leadPath, "--words", aligned, "--lag", String(lag), "--out", refined,
      ], { stdio: ["ignore", 2, 2] });

      // GATE: the new take must beat what's live (scored on the same stem)
      const curPath = path.join(dir, "current-words.json");
      fs.writeFileSync(curPath, JSON.stringify({ words: row.lyrics_synced?.words ?? [] }));
      const curScore = path.join(dir, "current-score.json");
      execFileSync(PY_REFINE, [path.join(__dirname, "refine-alignment.py"),
        "--lead", leadPath, "--words", curPath, "--lag", String(lag), "--out", curScore, "--report-only",
      ], { stdio: ["ignore", 2, 2] });
      const next = JSON.parse(fs.readFileSync(refined, "utf8"));
      const cur = JSON.parse(fs.readFileSync(curScore, "utf8"));
      const nb = next.score.after, cb = cur.score.before;
      const better = (row.lyrics_synced?.words?.length ?? 0) < 20 ||
        (nb.meanOnsetDist <= cb.meanOnsetDist + 0.01 && nb.silenceRate <= cb.silenceRate + 0.01);
      log(`  new: dist ${nb.meanOnsetDist}s sil ${nb.silenceRate} (${next.words.length}w) · live: dist ${cb.meanOnsetDist}s sil ${cb.silenceRate} (${row.lyrics_synced?.words?.length ?? 0}w) → ${better ? "APPLY" : "HOLD (not better — check the text)"}`);
      if (!better || DRY) continue;

      fs.appendFileSync(JOURNAL, JSON.stringify({ at: new Date().toISOString(), slug, prev: row.lyrics_synced }) + "\n");
      const { error } = await db.from("tracks").update({
        lyrics_synced: { source: "aligned-inbox", alignedAt: new Date().toISOString().slice(0, 10), words: next.words },
        lyrics: fs.readFileSync(path.join(INBOX, `${slug}.txt`), "utf8").trim(),
      }).eq("id", slug);
      if (error) { log("  ✗ apply:", error.message); continue; }
      fs.renameSync(path.join(INBOX, `${slug}.txt`), path.join(DONE, `${slug}.txt`));
      applied.push(slug);
      log("  ✓ applied + journaled");
    } catch (e) {
      log("  ✗", String(e).slice(0, 140));
    }
  }

  if (applied.length && !DRY) {
    log(`\n▶ refreshing melody for: ${applied.join(", ")}`);
    execFileSync("node", [path.join(ROOT, "scripts", "stem-analysis", "melody-batch.mjs"),
      "--only", applied.join(","), "--force", "--publish"], { stdio: ["ignore", 2, 2] });
  }
  log(`\n${applied.length} applied · done files moved to inbox/done/`);
}

main();

#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LOOK SHEET — render SEVERAL variants of the same moment as one contact
// sheet, instead of one video per guess.
//
// A still settles composition, depth, typography and contrast, which is what
// a look argument is actually about; motion and pacing are a separate question
// and a separate test. A still also costs about ten seconds against ninety for
// a video, so six variants side by side is cheaper than one wrong video — and
// far easier to choose from than a list of questions in prose.
//
//   node scripts/perf/look-sheet.mjs --track <slug> --at 118.4 \
//     --variants variants.json [--audio path] [--out sheet.png] [--cols 3]
//
// variants.json: [{ "label": "tilt 38", "deck": { "study": { ... } } }, ...]
// Each entry's `deck` is merged over the track's existing deck for that shot.
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const TRACK = args.track, AT = Number(args.at);
const BASE = args.base || "http://localhost:3218";
const COLS = Number(args.cols ?? 3);
const OUT = String(args.out ?? "look-sheet.png");
if (!TRACK || !isFinite(AT) || !args.variants) {
  console.error("usage: --track <slug> --at <seconds> --variants <file.json> [--audio p] [--out p] [--cols n]");
  process.exit(2);
}
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const env = {};
for (const f of [".env", ".env.local"]) {
  const p = path.join(REPO, f); if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const variants = JSON.parse(fs.readFileSync(args.variants, "utf8"));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "looksheet-"));

const { data } = await db.from("tracks").select("planet").eq("id", TRACK);
if (!data?.length) { console.error(`no track ${TRACK}`); process.exit(2); }
const original = data[0].planet;

const shots = [];
try {
  for (const [i, v] of variants.entries()) {
    const planet = structuredClone(original);
    Object.assign(planet.dynamicPlus.deck, v.deck ?? {});
    const { error } = await db.from("tracks").update({ planet }).eq("id", TRACK);
    if (error) throw new Error(error.message);
    const dir = path.join(TMP, `v${i}`);
    const a = ["scripts/perf/render-cut.mjs", "--vertical", "--track", TRACK,
      // Roll for a moment and take the LAST still, not the first. troika syncs
      // its glyphs asynchronously, so a frame grabbed immediately after mount
      // can be genuinely empty — half the first sheet came back blank that way.
      "--from", String(AT - 1.0), "--to", String(AT + 0.25), "--shots", "4",
      "--base", BASE, "--out", path.join(dir, "s.mp4")];
    if (args.audio) a.push("--audio", String(args.audio));
    execFileSync("node", a, { cwd: REPO, stdio: ["ignore", "ignore", "ignore"] });
    // render-cut writes stills into a .render-<track>-v folder beside --out
    const shotDir = fs.readdirSync(dir).map((f) => path.join(dir, f)).find((f) => fs.statSync(f).isDirectory());
    const pngs = shotDir ? fs.readdirSync(shotDir).filter((f) => f.endsWith(".png")).sort() : [];
    const png = pngs[pngs.length - 1];
    if (!png) { console.error(`  ${v.label}: no still produced`); continue; }
    const src = path.join(shotDir, png);
    const tagged = path.join(TMP, `t${i}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf",
      `scale=340:-1,drawtext=text='${String(v.label).replace(/[':]/g, " ")}':x=10:y=10:fontsize=19:fontcolor=white:box=1:boxcolor=black@0.75`,
      "-frames:v", "1", tagged]);
    shots.push(tagged);
    console.log(`  ✓ ${v.label}`);
  }
  if (!shots.length) { console.error("nothing rendered"); process.exit(1); }
  const rows = Math.ceil(shots.length / COLS);
  // tile over a numbered sequence: xstack needs a hand-built layout string and
  // every input exactly the same size, and one row of scale=340:-1 came out a
  // pixel shorter. tile just wants frames.
  const seq = path.join(TMP, "seq");
  fs.mkdirSync(seq, { recursive: true });
  shots.forEach((f, i) => fs.copyFileSync(f, path.join(seq, `f${String(i).padStart(3, "0")}.png`)));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1",
    "-i", path.join(seq, "f%03d.png"),
    "-vf", `scale=340:604,tile=${COLS}x${rows}:margin=6:padding=5:color=black`,
    "-frames:v", "1", OUT]);
  console.log(`\nsheet → ${OUT}  (${shots.length} variants, ${COLS}x${rows})`);
} finally {
  await db.from("tracks").update({ planet: original }).eq("id", TRACK);   // always restore
  fs.rmSync(TMP, { recursive: true, force: true });
}

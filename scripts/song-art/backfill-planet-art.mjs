#!/usr/bin/env node
// BACKFILL PLANET ART — give every art-less planet its base backdrops.
//
// For each track whose planet has analysis but NO assets.keywords (the shows
// play on a bare stage): render keyword art + section-emotion art exactly like
// onboard-song.mjs step 7 (reusing generate.mjs), upload the webps to R2
// planets/<slug>/, and wire planet.assets.{keywords,sections} in Supabase —
// preserving any existing assets keys (stems, stemAudio, stemLag, alt).
//
// The Rooklyn/Riverboat family renders in the owner's B&W+gold voice
// (wr-generate.mjs is the reference): black and white world, money still gold.
//
//   node scripts/song-art/backfill-planet-art.mjs [--only slug,slug] [--dry]
//     [--host http://localhost:8188]

import { createClient } from "@supabase/supabase-js";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const HOST = args.includes("--host") ? args[args.indexOf("--host") + 1] : "http://localhost:8188";
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const log = (...a) => console.error(...a);

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("no SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: env.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: env.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: env.ENDPOINT,
};
const r2put = (local, key) => execFileSync("rclone", ["copyto", local, `R2:${env.BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });

// THE RULE (owner's words): black and white world, but the money still gold.
// Applies to Whistle on the River + anything Rooklyn / Riverboat Boys.
const BW_GOLD = "high-contrast black and white photography, mississippi river noir, deep blacks and silver mist, film grain, symbolic still life, no people, monochrome everything except money and gold which glow in rich saturated metallic gold, selective color";
const BW_GOLD_SLUGS = new Set([
  "jayodeed-going-crazy-rooklyn-mix",
  "music-is-my-drug-rooklyn-mix",
  "one-tap-away-riverboat-bad-boys-remix",
]);

const webpName = (w) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function runGen(planetData, jsonPath, outDir, id) {
  writeFileSync(jsonPath, JSON.stringify(planetData));
  const g = spawnSync("node", [join(HERE, "generate.mjs"),
    "--planet", jsonPath, "--out", outDir, "--song", id, "--host", HOST, "--max", "16"],
    { stdio: ["ignore", 2, 2] });
  if (g.status !== 0) throw new Error("generate.mjs failed for " + outDir);
  return JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
}

// Targets: planets with analysis but no keyword art wired.
const { data: rows, error } = await db.from("tracks").select("id, planet").not("planet", "is", null);
if (error) { console.error(error.message); process.exit(1); }
const targets = rows.filter((r) => r.planet?.analysis?.keywords?.length
  && !Object.keys(r.planet?.assets?.keywords ?? {}).length
  && (!only || only.has(r.id)));
log(`${targets.length} planets need base art${DRY ? " (dry)" : ""}: ${targets.map((r) => r.id).join(", ")}`);
if (DRY) process.exit(0);

const up = await fetch(`${HOST}/system_stats`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
if (!up) { console.error("ComfyUI not reachable at " + HOST); process.exit(1); }

let done = 0, failed = [];
for (const row of targets) {
  const id = row.id, planet = row.planet, a = planet.analysis;
  const styleHint = BW_GOLD_SLUGS.has(id) ? BW_GOLD : planet.styleHint;
  const tmpDir = join(HERE, ".backfill-tmp");
  mkdirSync(tmpDir, { recursive: true });
  try {
    log(`\n━━ ${id}${BW_GOLD_SLUGS.has(id) ? " (B&W+gold)" : ""}`);
    const keywords = {}, sections = {};

    const kwDir = join(HERE, `${id}-kw`);
    const kwMan = runGen({ styleHint, analysis: a }, join(tmpDir, `${id}-kw.json`), kwDir, id);
    for (const im of kwMan.images) {
      const name = webpName(im.word);
      const webp = join(tmpDir, `${name}.webp`);
      await sharp(join(kwDir, im.file)).webp({ quality: 82 }).toFile(webp);
      r2put(webp, `planets/${id}/${name}.webp`);
      keywords[im.word.toLowerCase()] = `/planets/${id}/${name}.webp`;
    }

    const emotions = [...new Set((a.sections ?? []).map((s) => s.emotion).filter(Boolean))];
    if (emotions.length) {
      const secPlanet = {
        styleHint,
        analysis: {
          overallMood: a.overallMood,
          keywords: emotions.map((e) => ({ word: e, emotion: e, imageryPrompt: `abstract scene expressing '${e}'` })),
        },
      };
      const secDir = join(HERE, `${id}-sec`);
      const secMan = runGen(secPlanet, join(tmpDir, `${id}-sec.json`), secDir, id);
      for (const im of secMan.images) {
        const name = webpName(im.word);
        const webp = join(tmpDir, `${name}.webp`);
        await sharp(join(secDir, im.file)).webp({ quality: 82 }).toFile(webp);
        r2put(webp, `planets/${id}/${name}.webp`);
        sections[im.word.toLowerCase()] = `/planets/${id}/${name}.webp`;
      }
    }

    if (!Object.keys(keywords).length) throw new Error("no keyword art rendered");
    const assets = { ...(planet.assets ?? {}), keywords, sections };
    const { error: e2 } = await db.from("tracks").update({ planet: { ...planet, assets } }).eq("id", id);
    if (e2) throw new Error(e2.message);
    done++;
    log(`  ✔ wired ${Object.keys(keywords).length} kw + ${Object.keys(sections).length} sec → tracks.planet.assets`);
  } catch (e) { failed.push([id, e.message]); log(`  ✘ ${id}: ${e.message}`); }
}
log(`\nbackfilled ${done}/${targets.length}${failed.length ? ` · FAILED: ${failed.map(([i, m]) => `${i} (${m})`).join(", ")}` : ""}`);

// Neutralise the gallery pool for this song.
//
// KineticStage:643 pooledArt() rotates gallery.json's per-word variants in
// ALONGSIDE assets.keywords — `pool = [base, ...extra]`. This song's pool holds
// 62 images of the OLD SDXL coral voice across 17 words, including `build` and
// `light` (which we re-shot) and `different` / `summer` / `waiting` (which have
// no base of ours at all, so the OLD art is all that would render). Any of
// those firing inside the cut breaks the "own planet per song" law mid-video.
//
// The old file is downloaded and kept in the profile first, so reverting the
// planet JSON plus re-uploading that backup restores the previous look exactly.
// The scene files themselves are untouched — the new art went to a `debut/`
// subpath precisely so nothing had to be overwritten.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PUBLIC = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const REPO = "/home/xsyprime/Hermes/x1c7.com";
const PROFILE = `${REPO}/scripts/song-analysis/profiles/different-this-summer`;
const REMOTE = "planets/different-this-summer/gallery.json";

const env = Object.fromEntries(readFileSync(`${REPO}/.env`, "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));

const rcloneEnv = {
  ...process.env,
  RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: env.ACCESS_KEY_ID,
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: env.SECRET_ACCESS_KEY,
  RCLONE_CONFIG_R2_ENDPOINT: env.ENDPOINT,
};

const prev = await (await fetch(`${PUBLIC}/${REMOTE}?cb=${Date.now()}`)).json();
const pools = Object.entries(prev.art ?? {});
console.log(`current pool: ${pools.length} words, ${pools.reduce((n, [, v]) => n + v.length, 0)} images`);
writeFileSync(`${PROFILE}/pre-refix-backup/gallery-before-debut-cut.json`, JSON.stringify(prev, null, 1));

const next = { slug: "different-this-summer", model: "flux/kontext-pro (BLUEPRINT DAWN)", art: {} };
const tmp = join(tmpdir(), `gallery-${Date.now()}.json`);
writeFileSync(tmp, JSON.stringify(next, null, 2));

if (!process.argv.includes("--write")) {
  console.log("dry run — pass --write to upload the emptied pool");
  process.exit(0);
}

execFileSync("rclone", ["copyto", tmp, `R2:${env.BUCKET}/${REMOTE}`, "--s3-no-check-bucket", "--no-traverse"],
  { env: rcloneEnv, stdio: ["ignore", "ignore", "inherit"] });

const res = await fetch(`${PUBLIC}/${REMOTE}?cb=${Date.now()}`);
const edge = await res.text();
const local = statSync(tmp).size;
const ok = edge.length === local && JSON.parse(edge).art && !Object.keys(JSON.parse(edge).art).length;
console.log(`${ok ? "✓" : "✗"} edge local=${local} edge=${edge.length} pools=${Object.keys(JSON.parse(edge).art).length}`);
if (!ok) process.exit(1);
console.log("gallery neutralised — assets.keywords is now the only source of scene art");

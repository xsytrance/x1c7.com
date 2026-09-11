#!/usr/bin/env node
// Push the ONE WORLD GATE plates to R2 under planets/international-mode/.
// KineticStage resolves every "/planets/..." path through the R2 public
// bucket (playbook §19/§20) — public/planets/ alone is invisible to it.
// PNG -> webp q90 via ffmpeg (cwebp isn't installed on this box).
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "international-mode";
const SRC_PNG = "scripts/intlmode/plates";
const SRC_WEBP = "scripts/intlmode/webp";
const dry = process.argv.includes("--dry");

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

mkdirSync(SRC_WEBP, { recursive: true });

// Pick the eyes-on-approved variant per shot. -0 is the first seed unless
// noted otherwise below (edit after reviewing the contact sheet).
const PICKS = {
  flags: "-0", stamp: "-0", move: "-0", world: "-0", road: "-0", bass: "-1",
  airplane: "-1", whiplash: "-1", bk: "-0", stars: "-0", street: "-0", charts: "-1",
  globe: "-0", stadium: "-0", hands: "-0", fireworks: "-0", kids: "-0", summit: "-0",
};

console.log(`${Object.keys(PICKS).length} plates -> ${base}/planets/${SLUG}/`);
let ok = 0, bad = 0;
for (const [name, tag] of Object.entries(PICKS)) {
  const pngPath = join(SRC_PNG, `${name}${tag}.png`);
  if (!existsSync(pngPath)) { console.log(`✗ ${name} missing (${pngPath})`); bad++; continue; }
  const webpPath = join(SRC_WEBP, `${name}.webp`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", pngPath, "-quality", "90", webpPath]);
  const body = readFileSync(webpPath);
  const key = `planets/${SLUG}/scene-${name}.webp`;
  if (dry) { console.log(`· ${key} ${(body.length / 1024).toFixed(0)}KB (dry)`); continue; }
  const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "image/webp" } });
  if (!put.ok) { console.log(`✗ ${name} PUT ${put.status}`); bad++; continue; }
  const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
  if (!got.ok || Number(got.headers.get("content-length")) !== body.length) {
    console.log(`✗ ${name} edge-verify failed (${got.status})`); bad++; continue;
  }
  console.log(`✓ ${name} ${(body.length / 1024).toFixed(0)}KB`);
  ok++;
}
console.log(`\n${ok} uploaded, ${bad} failed`);
if (bad) process.exit(1);

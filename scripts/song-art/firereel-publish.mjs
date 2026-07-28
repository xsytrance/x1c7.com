#!/usr/bin/env node
// Publish the psychedelic set to R2 under psy-* keys.
//
// New filenames, not overwrites: the song's original night-noir art stays
// exactly where it is, so this whole cut reverts by restoring the planet JSON
// and nothing on the bucket has to be undone.
//
// Every upload is byte-verified against the public edge afterwards — silent
// upload failures have bitten this pipeline before (see publish-scenes.mjs).
//
// Usage: node scripts/song-art/ute-psy-publish.mjs [--dry]

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const OUT = join(HERE, "firereel-out");
const SLUG = "i-won-t-be-your-fire";
const dry = process.argv.includes("--dry");

function loadEnv(f) {
  const o = {};
  if (!existsSync(f)) return o;
  for (const l of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return o;
}
const E = { ...loadEnv(join(REPO, ".env")), ...loadEnv(join(REPO, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const PUB = E.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const files = readdirSync(OUT).filter((f) => f.startsWith("fr-") && f.endsWith(".webp")).sort();
console.error(`${files.length} webp to publish → planets/${SLUG}/`);

let ok = 0, bad = 0;
for (const f of files) {
  const local = join(OUT, f);
  const size = statSync(local).size;
  const key = `planets/${SLUG}/${f}`;
  if (dry) { console.error(`[dry] ${key}  ${size}B`); continue; }
  const put = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT", body: readFileSync(local), headers: { "Content-Type": "image/webp" },
  });
  if (!put.ok) { console.error(`✗ PUT ${put.status} ${key}`); bad++; continue; }
  // Byte-verify at the edge with a cache-buster.
  const got = await fetch(`${PUB}/${key}?cb=${Date.now()}${Math.random()}`, { cache: "no-store" });
  const n = got.ok ? (await got.arrayBuffer()).byteLength : -1;
  if (n !== size) { console.error(`✗ VERIFY ${key} local=${size} edge=${n}`); bad++; continue; }
  ok++;
  console.error(`✓ ${key}  ${size}B`);
}
console.error(`\n${ok} verified, ${bad} failed`);
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// v2 reuses v1's plates verbatim (same R2 prefix, referenced by absolute path
// in assets.*), so nothing needs re-uploading EXCEPT gallery.json: KineticStage
// fetches that from `planets/<track.id>/gallery.json` and nowhere else, so a new
// slug needs its own copy or the per-word pools silently do nothing.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "days-drift-by-cut-v2";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;

const body = readFileSync("scripts/ddb/v2_gallery.json");
const key = `planets/${SLUG}/gallery.json`;
const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "application/json" } });
if (!put.ok) { console.error(`✗ PUT ${put.status}`); process.exit(1); }
const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
if (!got.ok || Number(got.headers.get("content-length")) !== body.length) {
  console.error(`✗ edge-verify failed (${got.status})`); process.exit(1);
}
const pools = Object.keys(JSON.parse(body.toString()).art);
console.log(`✓ ${key} ${(body.length / 1024).toFixed(1)}KB — pools: ${pools.join(", ")}`);

// Every plate v2 references lives under v1's prefix; prove they're all reachable
// before a render blames the engine for a black backdrop (§20).
const row = JSON.parse(readFileSync("scripts/ddb/v2_row.json", "utf8"));
const urls = new Set([
  ...Object.values(row.planet.assets.keywords),
  ...Object.values(row.planet.assets.sections),
  ...Object.keys(row.planet.assets.shots),
  ...pools.flatMap((p) => JSON.parse(body.toString()).art[p]),
]);
let bad = 0;
for (const u of urls) {
  const r = await fetch(`${EDGE}${u}`, { method: "HEAD" });
  if (!r.ok) { console.log(`✗ ${u} ${r.status}`); bad++; }
}
console.log(bad ? `\n${bad} plate(s) UNREACHABLE` : `\nall ${urls.size} referenced plates reachable on the edge`);
if (bad) process.exit(1);

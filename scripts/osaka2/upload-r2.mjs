#!/usr/bin/env node
// Push the lacquer plates to R2 under planets/<slug>/.
//
// This is not optional decoration: KineticStage resolves every "/planets/..."
// path through PLANET_BASE (lib/engineHost.ts), which is the R2 public bucket.
// Files sitting in public/planets/ are served fine by next dev and the engine
// never asks for them — the first QA sheet came back as pure black frames
// because of exactly that.
//
// Every upload is byte-verified against the public edge with a cache-buster;
// silent upload failures have bitten this pipeline before.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";   // .env lives in the main checkout
const SLUG = "osaka-after-dark";
const SRC = `public/planets/${SLUG}`;
const dry = process.argv.includes("--dry");

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const files = readdirSync(SRC).filter((f) => f.endsWith(".webp")).sort();
console.log(`${files.length} plates -> ${base}/planets/${SLUG}/`);
let ok = 0, bad = 0;
for (const f of files) {
  const body = readFileSync(join(SRC, f));
  const key = `planets/${SLUG}/${f}`;
  if (dry) { console.log(`· ${f} ${(body.length / 1024).toFixed(0)}KB (dry)`); continue; }
  const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "image/webp" } });
  if (!put.ok) { console.log(`✗ ${f} PUT ${put.status}`); bad++; continue; }
  // byte-verify the edge, cache-busted
  const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
  const n = (await got.arrayBuffer()).byteLength;
  if (got.ok && n === body.length) { console.log(`✓ ${f} ${n} bytes verified`); ok++; }
  else { console.log(`✗ ${f} edge ${got.status} ${n} != ${body.length}`); bad++; }
}
console.log(`${ok} verified, ${bad} failed`);
if (bad) process.exit(1);

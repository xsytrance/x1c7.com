#!/usr/bin/env node
// DRINK DRINK v2 plates -> R2 under planets/drink-drink-v2/. New slug: the
// 2026-07 cut's art stays where it is.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "drink-drink-v2";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const WEBP = "scripts/dd2cut/webp";
// eyes-on pick per shot off the contact sheets
const PICKS = {
  pour1: "pour1-0", pour2: "pour2-0", pour3: "pour3-0", pour4: "pour4-0",
  pour5: "pour5-0", pour6: "pour6-1", pour7: "pour7-1", pour8: "pour8-0",
  manhead: "manhead-0", bottlebed: "bottlebed-0", barneon: "barneon-1",
  window: "window-0", smoke: "smoke-0", fan: "fan-0",
  emptyglass: "emptyglass-0", spill: "spill-1",
};
const loadEnv = (f) => Object.fromEntries((existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
mkdirSync(WEBP, { recursive: true });
let ok = 0, bad = 0;
console.log(`${Object.keys(PICKS).length} plates -> planets/${SLUG}/`);
for (const [name, file] of Object.entries(PICKS)) {
  const png = `scripts/dd2cut/plates/${file}.png`;
  if (!existsSync(png)) { console.log(`✗ ${name} missing`); bad++; continue; }
  const webp = join(WEBP, `${name}.webp`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", png, "-quality", "90", webp]);
  const body = readFileSync(webp);
  const key = `planets/${SLUG}/scene-${name}.webp`;
  const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "image/webp" } });
  if (!put.ok) { console.log(`✗ ${name} PUT ${put.status}`); bad++; continue; }
  const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
  if (!got.ok || Number(got.headers.get("content-length")) !== body.length) { console.log(`✗ ${name} edge ${got.status}`); bad++; continue; }
  console.log(`✓ ${name}`); ok++;
}
console.log(`\n${ok} uploaded, ${bad} failed`);
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Push the GOLDEN ATLAS expansion plates to R2 under planets/international-mode-atlas/.
// PNG -> webp q90 via ffmpeg (cwebp isn't installed on this box). Edge-verified,
// because a 200 from the S3 endpoint does not prove the public URL serves the
// right bytes (playbook §20).
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "international-mode-atlas";
const SRC = "scripts/intlmode/atlas-plates";
const WEBP = "scripts/intlmode/atlas-webp";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const dry = process.argv.includes("--dry");

// Eyes-on picks off the contact sheets. amalfi is dropped: its "Italian" flag
// rendered red-and-white, and route66 already carries the famous-road brief.
const PICKS = {
  route66: "-0",                      // the flag reads clean: stripes + canton
  ph: "-1", ng: "-0", th: "-0", tr: "-1", ma: "-0",
  de: "-0", es: "-0", gb: "-1", kr: "-1", sg: "-1",
};

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;

mkdirSync(WEBP, { recursive: true });
console.log(`${Object.keys(PICKS).length} plates -> planets/${SLUG}/`);
let ok = 0, bad = 0;
for (const [name, tag] of Object.entries(PICKS)) {
  const png = join(SRC, `${name}${tag}.png`);
  if (!existsSync(png)) { console.log(`✗ ${name} missing ${png}`); bad++; continue; }
  const webp = join(WEBP, `${name}.webp`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", png, "-quality", "90", webp]);
  const body = readFileSync(webp);
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

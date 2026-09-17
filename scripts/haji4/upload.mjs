#!/usr/bin/env node
// HAJIMEMASHITE v4 plates -> R2 under planets/hajimemashite-v4/.
// A NEW slug, deliberately: the v3 cut still plays off planets/hajimemashite/
// and must keep working. Edge-verified (playbook §20 — a 200 from the S3
// endpoint is not proof the public URL serves the right bytes).
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "hajimemashite-v4";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const WEBP = "scripts/haji4/webp";
const dry = process.argv.includes("--dry");

// World plates: eyes-on pick per shot off the contact sheets.
const WORLD = {
  trap: "trap-0", street: "street-1", keys: "keys-0", tempo: "tempo-0",
  throne: "throne-1", glyph: "glyph-0", doors: "doors-1", lights: "lights-1",
  house: "house-0", secret: "secret-0", sound: "sound-0", wheels: "wheels-1",
  sign: "sign-1", rain: "rain-1",
  they: "crowd-1",      // several silhouettes walking away — "they said she's so cute"
  walking: "crowd-0",   // one lone silhouette — carries "watch how I'm walking"
                        // AND "I didn't walk in alone" with no portrait needed
};
// People plates: already webp at 832x1472 out of the Kontext pass.
const PEOPLE = ["hajimemashite", "kizuna", "face", "name", "levelready", "wheelsman"];

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
mkdirSync(WEBP, { recursive: true });

const jobs = [];
for (const [name, file] of Object.entries(WORLD)) {
  const png = `scripts/haji4/plates/${file}.png`;
  if (!existsSync(png)) { console.log(`✗ ${name} missing ${png}`); continue; }
  const webp = join(WEBP, `${name}.webp`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", png, "-quality", "90", webp]);
  jobs.push([name, webp]);
}
for (const name of PEOPLE) {
  const w = `scripts/haji4/people/${name}.webp`;
  if (!existsSync(w)) { console.log(`✗ ${name} missing ${w}`); continue; }
  jobs.push([name, w]);
}

console.log(`${jobs.length} plates -> planets/${SLUG}/`);
let ok = 0, bad = 0;
for (const [name, path] of jobs) {
  const body = readFileSync(path);
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

#!/usr/bin/env node
// Derive lightweight web assets from the collector covers for the /music shelf:
//   covers/web/<slug>-spine.webp  (spine strip, 96×734)
//   covers/web/<slug>-card.webp   (full cover, 720²)
// Sources: local out/<slug>.png for collector renders; R2 covers for the three
// reference covers that were never re-rendered locally.
import sharp from "sharp";
import { readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "web");
mkdirSync(OUT, { recursive: true });

function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(HERE, "..", "..", "..", ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

// slug → source. Local renders cover everything except the reference three.
const EXTRA = {
  "under-the-elevated": `${PUB}/covers/Under%20The%20Elevated.png`,
};

const SPINE_FRAC = 268 / 2048;

async function put(key, buf) {
  const r = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", body: buf, headers: { "Content-Type": "image/webp" } });
  if (!r.ok) throw new Error(`put ${r.status} ${key}`);
}

async function processOne(slug, srcBuf) {
  const img = sharp(srcBuf);
  const meta = await img.metadata();
  const spineW = Math.round(meta.width * SPINE_FRAC);
  const spine = await sharp(srcBuf).extract({ left: 0, top: 0, width: spineW, height: meta.height })
    .resize(96, 734).webp({ quality: 78 }).toBuffer();
  const card = await sharp(srcBuf).resize(720, 720, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
  await put(`covers/web/${slug}-spine.webp`, spine);
  await put(`covers/web/${slug}-card.webp`, card);
  return { spine: spine.length, card: card.length };
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

let n = 0;
const local = readdirSync(join(HERE, "out")).filter((f) => f.endsWith(".png") && !f.startsWith("shelf") && !f.startsWith("_"))
  .filter((f) => !only || f === `${only}.png`);
for (const f of local) {
  const slug = f.replace(/\.png$/, "");
  const s = await processOne(slug, readFileSync(join(HERE, "out", f)));
  console.error(`${++n} ${slug} spine=${(s.spine / 1024) | 0}K card=${(s.card / 1024) | 0}K`);
}
for (const [slug, url] of Object.entries(EXTRA)) {
  if (only && slug !== only) continue;
  const r = await fetch(url);
  if (!r.ok) { console.error(`skip ${slug}: ${r.status}`); continue; }
  const s = await processOne(slug, Buffer.from(await r.arrayBuffer()));
  console.error(`${++n} ${slug} (remote) spine=${(s.spine / 1024) | 0}K card=${(s.card / 1024) | 0}K`);
}
console.error("done:", n);

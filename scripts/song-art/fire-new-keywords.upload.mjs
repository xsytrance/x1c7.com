#!/usr/bin/env node
// One-off: upload the 4 new "I Won't Be Your Fire" keyword paintings (8 webps)
// to R2 using the same signed-PUT path feed-worker.mjs uses (rclone not needed).
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...process.env, ...loadEnv(join(ROOT, ".env")) };
const BUCKET = E.BUCKET || "x1c7-music";
const ENDPOINT = (E.ENDPOINT || "").replace(/\/$/, "");
const PUB = (E.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, "");
for (const k of ["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT"]) if (!E[k]) { console.error(`✗ missing ${k} in .env`); process.exit(1); }

const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
async function r2put(key, body, ct) { const r = await aws.fetch(`${ENDPOINT}/${BUCKET}/${encodeURI(key)}`, { method: "PUT", body, headers: { "Content-Type": ct } }); if (!r.ok) throw new Error(`R2 put ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`); }

const SLUG = "i-won-t-be-your-fire";
const words = ["knife", "cage", "moon", "wire"];
const files = words.flatMap((w) => [`${w}.webp`, `${w}-2.webp`]);

for (const f of files) {
  const local = join(ROOT, "public", "planets", SLUG, f);
  if (!existsSync(local)) { console.error(`✗ missing local file: ${local}`); process.exit(1); }
  const key = `planets/${SLUG}/${f}`;
  await r2put(key, readFileSync(local), "image/webp");
  console.error(`✔ uploaded ${key}`);
}

// verify each is fetchable from the public URL
let ok = true;
for (const f of files) {
  const url = `${PUB}/planets/${SLUG}/${f}`;
  const r = await fetch(url, { method: "HEAD", cache: "no-store" });
  const ct = r.headers.get("content-type");
  console.error(`${r.ok ? "✔" : "✗"} ${r.status} ${ct || ""}  ${url}`);
  if (!r.ok) ok = false;
}
process.exit(ok ? 0 : 1);

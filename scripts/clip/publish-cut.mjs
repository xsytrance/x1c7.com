#!/usr/bin/env node
// PUBLISH A CUT — push a finished vertical master to R2 and hand back the link.
//
//   node scripts/clip/publish-cut.mjs <file.mp4> [--id <12hex>] [--dry]
//
// Convention (established by the first two cuts on the bucket, formalised here
// 2026-09-15): objects live at `cuts/<12 hex>/<basename>.mp4`. The random id is
// the whole access control — the bucket's public edge serves anything under it,
// so an unguessable prefix is what keeps an unreleased cut unlisted. Reusing an
// id REPLACES that cut in place, which is what you want when you have re-rendered
// the same video and already gave someone the link; omit --id for a fresh one.
//
// Uploads are verified against the EDGE, not the API response — the plate
// uploader learned that the hard way (playbook §20): a 200 from the S3 endpoint
// does not prove the public URL serves the right bytes.
import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { randomBytes } from "node:crypto";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const file = args.find((a) => !a.startsWith("--"));
const idFlag = args.indexOf("--id");
const id = idFlag >= 0 ? args[idFlag + 1] : randomBytes(6).toString("hex");

if (!file || !existsSync(file)) {
  console.error("usage: node scripts/clip/publish-cut.mjs <file.mp4> [--id <12hex>] [--dry]");
  process.exit(1);
}
if (!/^[0-9a-f]{12}$/.test(id)) { console.error(`bad --id ${id}: want 12 hex chars`); process.exit(1); }

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;

const key = `cuts/${id}/${basename(file)}`;
const size = statSync(file).size;
const mib = (size / 1048576).toFixed(1);
console.log(`${basename(file)}  ${mib} MiB  ->  ${key}`);
if (dry) { console.log(`(dry) ${EDGE}/${key}`); process.exit(0); }

const body = readFileSync(file);
const put = await aws.fetch(`${base}/${key}`, {
  method: "PUT", body, headers: { "content-type": "video/mp4" },
});
if (!put.ok) { console.error(`✗ PUT ${put.status} ${(await put.text()).slice(0, 300)}`); process.exit(1); }

// Edge verify: HEAD it through the public hostname and match the byte count.
const head = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { method: "HEAD", cache: "no-store" });
const got = Number(head.headers.get("content-length"));
if (!head.ok || got !== size) {
  console.error(`✗ edge verify failed: HTTP ${head.status}, content-length ${got} != ${size}`);
  process.exit(1);
}
console.log(`✓ edge serves ${got} bytes as ${head.headers.get("content-type")}`);
console.log(`\n${EDGE}/${key}`);

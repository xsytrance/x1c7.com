#!/usr/bin/env node
// Upload ONE collector cover to R2: out/<slug>.png → covers/collector/<slug>.png.
// Exists so the covers API can publish from plain node — Next's patched fetch
// drops Content-Length on binary PUTs and R2 answers 411.
// Usage: node publish-one.mjs <slug>
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(HERE, "..", "..", "..", ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;

const slug = process.argv[2];
if (!slug) { console.error("usage: publish-one.mjs <slug>"); process.exit(2); }
const src = join(HERE, "out", `${slug}.png`);
if (!existsSync(src)) { console.error(`missing ${src}`); process.exit(1); }
const key = `covers/collector/${slug}.png`;
const r = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, {
  method: "PUT", body: readFileSync(src), headers: { "Content-Type": "image/png" },
});
if (!r.ok) { console.error(`FAIL ${r.status} ${key}`); process.exit(1); }
console.error(`uploaded ${key}`);

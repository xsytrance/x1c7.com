#!/usr/bin/env node
// Upload ONE local file to R2 at an explicit key. Exists (like publish-one.mjs)
// so the studio API can publish binaries from plain node — Next's patched fetch
// drops Content-Length on binary PUTs and R2 answers 411.
// Usage: node upload-file.mjs <localPath> <r2Key> <contentType>
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(HERE, "..", "..", "..", ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;

const [src, key, ct] = process.argv.slice(2);
if (!src || !key || !ct) { console.error("usage: upload-file.mjs <localPath> <r2Key> <contentType>"); process.exit(2); }
if (!existsSync(src)) { console.error(`missing ${src}`); process.exit(1); }
const r = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, {
  method: "PUT", body: readFileSync(src), headers: { "Content-Type": ct },
});
if (!r.ok) { console.error(`FAIL ${r.status} ${key}`); process.exit(1); }
console.error(`uploaded ${key}`);

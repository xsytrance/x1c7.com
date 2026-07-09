#!/usr/bin/env node
// Upload collector covers to R2 under covers/collector/<slug>.png (new keys —
// originals in covers/ are never touched).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(HERE, "..", "..", "..", ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;

const files = readdirSync(join(HERE, "out")).filter((f) => f.endsWith(".png") && !f.startsWith("shelf"));
let n = 0;
for (const f of files) {
  const key = `covers/collector/${f}`;
  const r = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT", body: readFileSync(join(HERE, "out", f)), headers: { "Content-Type": "image/png" },
  });
  if (!r.ok) { console.error(`FAIL ${r.status} ${key}`); continue; }
  n++; console.error(`${n}/${files.length} ${key}`);
}
// the shelf too — it's the showcase banner
const shelf = await aws.fetch(`${base}/covers/collector/_shelf.png`, { method: "PUT", body: readFileSync(join(HERE, "out", "shelf.png")), headers: { "Content-Type": "image/png" } });
console.error(shelf.ok ? "shelf uploaded" : `shelf FAIL ${shelf.status}`);
console.error("done");

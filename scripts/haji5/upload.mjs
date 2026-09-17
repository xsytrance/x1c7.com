#!/usr/bin/env node
// Only the TWO repaired plates go up, under planets/hajimemashite-v5/.
// The other seventeen v3 plates are already native portrait and already on R2
// at planets/hajimemashite/ — the v5 row references them in place rather than
// duplicating them, which also guarantees the v3 cut keeps its own art intact.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const loadEnv = (f) => Object.fromEntries((existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
let bad = 0;
for (const name of ["cute", "levelready"]) {
  const body = readFileSync(`scripts/haji5/plates/${name}.webp`);
  const key = `planets/hajimemashite-v5/scene-${name}.webp`;
  const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "image/webp" } });
  if (!put.ok) { console.log(`✗ ${name} PUT ${put.status}`); bad++; continue; }
  const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
  if (!got.ok || Number(got.headers.get("content-length")) !== body.length) { console.log(`✗ ${name} edge-verify ${got.status}`); bad++; continue; }
  console.log(`✓ ${name} ${(body.length / 1024).toFixed(0)}KB`);
}
process.exit(bad ? 1 : 0);

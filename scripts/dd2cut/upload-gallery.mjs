#!/usr/bin/env node
// "drink" is 39 of 68 words — 57%. Without a pool the frame freezes on one
// plate for whole chant runs (§3e, the lesson International Mode paid for).
// Every pour is in the rotation, so the chant literally pours a different
// drink each time it repeats.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "drink-drink-v2";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const P = (n) => `/planets/${SLUG}/scene-${n}.webp`;
const gallery = { slug: SLUG, art: {
  // pour7 is the keyword's BASE, so it is not repeated here
  drink: ["pour1","pour2","pour3","pour4","pour5","pour6","pour8","pour1","pour3","pour5"].map(P),
  save: [P("window"), P("barneon"), P("fan")],
  me:   [P("emptyglass"), P("spill"), P("smoke")],
}};
const loadEnv = (f) => Object.fromEntries((existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const key = `planets/${SLUG}/gallery.json`;
const body = Buffer.from(JSON.stringify(gallery, null, 2));
const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "application/json" } });
if (!put.ok) { console.error("PUT", put.status); process.exit(1); }
const live = await (await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" })).json();
console.log("pools:", Object.fromEntries(Object.entries(live.art).map(([k, v]) => [k, v.length])));
let bad = 0;
for (const u of new Set(Object.values(live.art).flat())) {
  const h = await fetch(`${EDGE}${u}`, { method: "HEAD", cache: "no-store" });
  if (!h.ok) { console.log("MISSING", u); bad++; }
}
console.log(bad ? `${bad} missing` : "all pooled plates verified on the edge");

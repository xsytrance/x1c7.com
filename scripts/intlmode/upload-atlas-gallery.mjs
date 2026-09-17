#!/usr/bin/env node
// The hook word's rotation pool. pooledArt() walks [base, ...pool] with a shot
// grammar (never two same-size shots back to back), so a hook that fires 15
// times needs MORE than 15 plates to stop repeating — the grammar skips, and
// section art lands on top of it. 24 countries + the globe now.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "international-mode-atlas";
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const P = (n) => `/planets/${SLUG}/scene-${n}.webp`;

// Every country plate on the planet, plus the night globe as the closer.
// jp is the keyword's BASE (pooledArt prepends it), so it is not listed here.
const COUNTRIES = [
  "eg", "in", "br", "gr", "pe", "it", "cn", "fr", "mx", "jo", "us", "au", "za",
  "ph", "ng", "th", "tr", "ma", "de", "es", "gb", "kr", "sg",
];
const gallery = {
  slug: SLUG,
  art: {
    international: [...COUNTRIES.map(P), P("globe")],
    // the other repeat-heavy words get somewhere to go as well
    worldwide: [P("world"), P("globe"), P("sg"), P("de")],
    yard: [P("jm"), P("ng"), P("br")],
    foreign: [P("fly"), P("th"), P("tr"), P("ma")],
  },
};

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const key = `planets/${SLUG}/gallery.json`;
const body = Buffer.from(JSON.stringify(gallery, null, 2));

const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "application/json" } });
if (!put.ok) { console.error(`✗ PUT ${put.status}`); process.exit(1); }
const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
const live = await got.json();
console.log(`✓ gallery.json — international pool ${live.art.international.length} plates`);
for (const k of Object.keys(live.art)) console.log(`   ${k}: ${live.art[k].length}`);
// every plate the pool names must actually be on the edge
let bad = 0;
for (const u of new Set(Object.values(live.art).flat())) {
  const h = await fetch(`${EDGE}${u}`, { method: "HEAD", cache: "no-store" });
  if (!h.ok) { console.log(`   ✗ MISSING ${u} (${h.status})`); bad++; }
}
console.log(bad ? `\n${bad} pooled plates missing on the edge` : "\nall pooled plates verified on the edge");
process.exit(bad ? 1 : 0);

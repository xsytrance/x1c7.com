#!/usr/bin/env node
// Publish gallery.json — the pooled art variants for the dominant chant word.
// KineticStage's pooledArt() rotates [keywords.international, ...gallery]
// every time "international" lands, instead of showing the same single
// image for the whole 30+ times it's sung. This is the fix for "the image
// barely changes" — the keyword alone (one static image) was never enough
// for a word this repeated; only the gallery pool gives real rotation.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "international-mode";
const R2PATH = `planets/${SLUG}`;

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const gallery = {
  slug: SLUG,
  model: "Juggernaut-XL_v9_RunDiffusionPhoto_v2",
  art: {
    // "international" fires 30+ times — a real rotation across ELEVEN
    // distinct plates (not the same 1-2 images recycled), so no stretch of
    // the chant looks like a still frame.
    international: [
      `/${R2PATH}/scene-world.webp`,
      `/${R2PATH}/scene-stars.webp`,
      `/${R2PATH}/scene-street.webp`,
      `/${R2PATH}/scene-bass.webp`,
      `/${R2PATH}/scene-charts.webp`,
      `/${R2PATH}/scene-globe.webp`,
      `/${R2PATH}/scene-stadium.webp`,
      `/${R2PATH}/scene-hands.webp`,
      `/${R2PATH}/scene-fireworks.webp`,
      `/${R2PATH}/scene-kids.webp`,
      `/${R2PATH}/scene-summit.webp`,
    ],
    // "stamp"/"move" each fire ~8x in the Build — give them real rotation too.
    stamp: [`/${R2PATH}/scene-bass.webp`, `/${R2PATH}/scene-hands.webp`],
    move: [`/${R2PATH}/scene-flags.webp`, `/${R2PATH}/scene-stars.webp`, `/${R2PATH}/scene-globe.webp`],
  },
};

const body = Buffer.from(JSON.stringify(gallery));
const key = `${R2PATH}/gallery.json`;
const put = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": "application/json" } });
console.log(put.ok ? `✓ uploaded ${key}` : `✗ PUT ${put.status}`);
const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
console.log(got.ok ? `✓ edge-verified (${(await got.text()).length}B)` : `✗ edge ${got.status}`);

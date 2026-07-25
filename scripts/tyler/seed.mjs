#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TYLER · SEED — move the 2026-07-17 takeover data out of the repo and into
// Juan's own tables, so that from here on HE owns it and edits it from his
// phone instead of asking anyone to change a TypeScript file.
//
// Source of truth for this one-time move: src/data/tylerhaze.ts (album facts,
// the owner's message, the 13-track detail map, verified links, gallery, and
// the album palette). Nothing here is invented — every link was verified on
// release day and that rule outlives this script.
//
// Idempotent: re-running updates the site row and upserts tracks BY TITLE, so
// it will not duplicate Juan's catalog if it runs twice. It never touches a
// track Juan added himself, and never overwrites his edits to `sort_order`,
// `spotlight` or `hidden` on an existing row.
//
//   node scripts/tyler/seed.mjs           # dry run — prints what it would do
//   node scripts/tyler/seed.mjs --apply
//
// .env needs: SUPABASE_SERVICE_ROLE_KEY
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = "https://kxbrjmbovjiwwcnepsfh.supabase.co";

// .env is not auto-loaded outside Next — read it the same way the other
// scripts in this repo do.
for (const file of [".env", ".env.local"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set (.env)");
  process.exit(1);
}

// ── Read the takeover data straight out of the TS module ──────────────────
// It's a plain data file (no imports, no runtime deps), so a light parse beats
// adding a TS toolchain to a one-time script.
const src = fs.readFileSync(path.join(ROOT, "src/data/tylerhaze.ts"), "utf8");

function block(name) {
  const start = src.indexOf(name);
  if (start < 0) throw new Error(`${name} not found in tylerhaze.ts`);
  // Skip past the TYPE annotation to the assignment — `Record<string, {...}>`
  // has braces of its own and they are not the value.
  const assign = src.slice(start).match(/=\s*[[{]/);
  if (!assign) throw new Error(`${name} has no value`);
  const open = start + assign.index + assign[0].length - 1;
  const closer = src[open] === "[" ? "]" : "}";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === src[open]) depth++;
    else if (src[i] === closer) {
      depth--;
      if (!depth) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

// eslint-disable-next-line no-eval
const evalBlock = (name) => eval(`(${block(name).replace(/,(\s*[}\]])/g, "$1")})`);

const TYLER = evalBlock("export const TYLER =");
const DETAILS = evalBlock("export const TYLER_TRACK_DETAILS:");
const LINKS = evalBlock("export const TYLER_LINKS:");
const TRACKLIST = evalBlock("export const TYLER_TRACKS =");
const PALETTE = evalBlock("export const TYLER_PALETTE =");
const GALLERY = Array.from({ length: 12 }, (_, i) =>
  `https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/tyler-haze/gallery/${String(i + 1).padStart(2, "0")}.webp`);

// ── Shape it for Juan's tables ────────────────────────────────────────────
const site = {
  id: "main",
  artist: TYLER.artist,
  by_line: TYLER.by,
  album: TYLER.album,
  released: TYLER.released,
  genre: TYLER.genre,
  cover: TYLER.cover,
  tagline: "OUT NOW",
  message: TYLER.message,
  rated: TYLER.ratedTyler,
  palette: PALETTE,
  sections: [
    { id: "hero", visible: true },
    { id: "tracks", visible: true },
    { id: "photos", visible: true },
    { id: "press", visible: true },
    { id: "zero", visible: true },
  ],
  links: LINKS,
  socials: [{ service: "Suno", url: "https://suno.com/@jc_gomez0311" }],
  options: { grain: true, scanlines: true, particles: true, font: "scrawl" },
  updated_at: new Date().toISOString(),
};

const tracks = TRACKLIST.map((title, i) => {
  const d = DETAILS[title] ?? {};
  return {
    title,
    story: d.story ?? null,
    words: d.words ?? [],
    art: d.art ?? null,
    show_slug: title === "#MADETOBREAK" ? TYLER.featuredTrackId : null,
    sort_order: i,
    spotlight: true,
    hidden: false,
  };
});

const media = GALLERY.map((url, i) => ({
  kind: "photo",
  r2_key: `tyler-haze/gallery/${String(i + 1).padStart(2, "0")}.webp`,
  url,
  caption: null,
  alt: `Tyler Haze — official artwork ${i + 1} of 12`,
  content_type: "image/webp",
  sort_order: i,
  hidden: false,
}));

console.log(`site      : ${site.artist} — ${site.album} (${tracks.length} tracks)`);
console.log(`links     : ${site.links.length} verified`);
console.log(`tracks    : ${tracks.map((t) => t.title).join(", ")}`);
console.log(`media     : ${media.length} gallery images`);
if (!APPLY) {
  console.log("\ndry run — nothing written. re-run with --apply");
  process.exit(0);
}

const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const { error: siteErr } = await db.from("tyler_site").upsert(site, { onConflict: "id" });
if (siteErr) throw siteErr;
console.log("✓ tyler_site");

// Upsert by title so a second run edits rather than duplicates — and so
// anything Juan has already changed about ordering/visibility survives.
const { data: existing } = await db.from("tyler_tracks").select("id,title,sort_order,spotlight,hidden");
const byTitle = new Map((existing ?? []).map((r) => [r.title, r]));
for (const t of tracks) {
  const prev = byTitle.get(t.title);
  const row = prev
    ? { ...t, id: prev.id, sort_order: prev.sort_order, spotlight: prev.spotlight, hidden: prev.hidden }
    : t;
  const { error } = await db.from("tyler_tracks").upsert(row, { onConflict: "id" });
  if (error) throw error;
}
console.log(`✓ tyler_tracks (${tracks.length})`);

const { data: haveMedia } = await db.from("tyler_media").select("r2_key");
const known = new Set((haveMedia ?? []).map((m) => m.r2_key));
const fresh = media.filter((m) => !known.has(m.r2_key));
if (fresh.length) {
  const { error } = await db.from("tyler_media").insert(fresh);
  if (error) throw error;
}
console.log(`✓ tyler_media (${fresh.length} new, ${media.length - fresh.length} already there)`);
console.log("\nseeded. tyler.x1c7.com now reads from the database, not the repo.");

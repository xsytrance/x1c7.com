#!/usr/bin/env node
// Scrape the public Suno profile (@xsytrance) and match clips to catalog
// tracks by normalized title. Emits suno-links.json + the SQL to apply.
// Public API, no auth: studio-api.prod.suno.com/api/profiles/<handle>

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDLE = "xsytrance";

const norm = (s) => String(s).toLowerCase()
  .replace(/[’'`´]/g, "'")
  .replace(/\[.*?\]|\(.*?\)/g, (m) => m) // keep qualifiers — remixes must stay distinct
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const clips = [];
for (let page = 1; page <= 20; page++) {
  const u = `https://studio-api.prod.suno.com/api/profiles/${HANDLE}?playlists_sort_by=upvote_count&clips_sort_by=created_at&page=${page}`;
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) { console.error(`page ${page}: HTTP ${r.status}`); break; }
  const j = await r.json();
  if (!j.clips?.length) break;
  clips.push(...j.clips.map((c) => ({ id: c.id, title: c.title, created: c.created_at })));
  console.error(`page ${page}: +${j.clips.length} (total ${clips.length}/${j.num_total_clips})`);
  if (clips.length >= (j.num_total_clips || Infinity)) break;
}

// newest first per title — keep first occurrence, note duplicates
const byTitle = new Map();
const dupes = [];
for (const c of clips) {
  const k = norm(c.title);
  if (byTitle.has(k)) dupes.push(c.title);
  else byTitle.set(k, c);
}

// hand-verified exact-title pins (title drift + the EN/JP normalization collision)
const HAND_MAP = {
  "i-won-t-be-your-fire": "I Won’t Be Your Fire",
  "i-won-t-be-your-fire-japanese-mix": "火じゃない — I Won’t Be Your Fire",
  "the-big-top-has-wi-fi-now": "The Big Top Has Wi-Fi",
  "jayodeed-going-crazy-rooklyn-mix": "xsytrance Presents: Jayodeed - Going Crazy (Rooklyn Mix)",
};
const byExact = new Map(clips.map((c) => [c.title.trim(), c]));

// catalog: released tracks from tracks.json (slug + title)
const SRC = JSON.parse(readFileSync(join(HERE, "tracks.json"), "utf8"));
const matches = [], missing = [];
for (const t of SRC.tracks) {
  const pinned = HAND_MAP[t.slug] ? byExact.get(HAND_MAP[t.slug]) : null;
  const c = pinned || byTitle.get(norm(t.title));
  if (c) { matches.push({ slug: t.slug, title: t.title, sunoTitle: c.title, url: `https://suno.com/song/${c.id}` }); byTitle.delete(norm(c.title)); }
  else missing.push(t.title);
}

writeFileSync(join(HERE, "suno-links.json"), JSON.stringify({ matches, missingInSuno: missing, unmatchedSunoClips: [...byTitle.values()].map((c) => c.title), duplicateTitles: dupes }, null, 1));
const sql = matches.map((m) => `UPDATE tracks SET suno_url = '${m.url}' WHERE id = '${m.slug}';`).join("\n");
writeFileSync(join(HERE, "suno-links.sql"), sql + "\n");
console.error(`\nmatched ${matches.length}/${SRC.tracks.length} tracks · ${missing.length} not found on suno · ${byTitle.size} suno clips unmatched · ${dupes.length} duplicate titles`);
console.error(`wrote suno-links.json + suno-links.sql`);

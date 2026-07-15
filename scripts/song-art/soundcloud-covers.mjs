// ═══════════════════════════════════════════════════════════════════════════
// SOUNDCLOUD COVER SYNC — put the new cover art on every SoundCloud upload
// without clicking through 67 edit dialogs by hand.
//
// No API app needed: this drives soundcloud.com in a real Chromium profile
// that YOU log into once. The profile persists at ~/.cache/soundcloud-profile
// so login is a one-time ceremony.
//
//   node scripts/song-art/soundcloud-covers.mjs --login
//       Opens a browser window. Log in to SoundCloud, then close the window.
//
//   node scripts/song-art/soundcloud-covers.mjs --scan
//       Walks your track manager, matches SC tracks to the site's catalog by
//       title, writes soundcloud-map.json beside this script. Review it —
//       fix any "unmatched" entries by hand (add {sc, cover, title}).
//
//   node scripts/song-art/soundcloud-covers.mjs --apply [--dry] [--limit N] [--only <substr>]
//       For every match not yet done: download the new cover, convert to a
//       1600px JPEG (SoundCloud wants ≥800px jpg/png), open the track's Edit
//       dialog, swap the image, save. Progress is checkpointed in the map
//       file, so it's safe to stop and resume. --dry rehearses without
//       touching anything.
//
// Be a good citizen: it's your own account and your own art, but the script
// still moves at human pace (4s between saves) and runs headed so you can
// watch every move and slam Ctrl-C anytime.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = join(os.homedir(), ".cache", "soundcloud-profile");
const MAP_FILE = join(HERE, "soundcloud-map.json");
const TMP = join(os.tmpdir(), "sc-covers");

const SUPABASE_URL = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const SUPABASE_KEY = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-"; // anon, read-only

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const norm = (s) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\[\](){}]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function catalog() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks?select=id,title,cover&order=sort_order.asc`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return (await r.json()).filter((t) => t.cover);
}

const launch = (headless = false) =>
  chromium.launchPersistentContext(PROFILE, {
    headless,
    viewport: { width: 1360, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

// ── login ────────────────────────────────────────────────────────────────────
async function login() {
  const ctx = await launch(false);
  const page = await ctx.newPage();
  await page.goto("https://soundcloud.com/signin");
  console.log("→ Log in to SoundCloud in the window (approve 2FA etc.).");
  console.log("→ When you can see your feed / avatar, just CLOSE the window.");
  await new Promise((res) => ctx.on("close", res));
  console.log("✓ profile saved — run --scan next");
}

// ── scan: your tracks ↔ the catalog ─────────────────────────────────────────
async function scan() {
  const cat = await catalog();
  const ctx = await launch(false);
  const page = await ctx.newPage();
  await page.goto("https://soundcloud.com/you/tracks", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  if (page.url().includes("signin")) { console.error("✗ not logged in — run --login first"); await ctx.close(); process.exit(1); }

  // scroll until the list stops growing (the manager lazy-loads)
  let last = 0;
  for (let i = 0; i < 40; i++) {
    const n = await page.locator('a[href*="soundcloud.com/"] , a[href^="/"]').count();
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1200);
    if (n === last && i > 4) break;
    last = n;
  }
  // Track links in the manager point at /<user>/<slug> (no extra path segments)
  const found = await page.evaluate(() => {
    const out = new Map();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      const text = (a.textContent || "").trim();
      if (!text || text.length < 2) continue;
      const m = href.match(/^\/([\w-]+)\/([\w-]+)$/);
      if (!m) continue;
      const [, , slug] = m;
      if (["tracks", "albums", "sets", "reposts", "stats", "you", "popular", "discover", "stream", "upload", "settings", "messages", "notifications"].includes(slug)) continue;
      if (!out.has(href)) out.set(href, text);
    }
    return [...out.entries()].map(([href, title]) => ({ url: "https://soundcloud.com" + href, title }));
  });
  await ctx.close();
  console.log(`found ${found.length} tracks on SoundCloud · ${cat.length} covers in the catalog`);

  const matches = [];
  const unmatchedSc = [];
  const takenCover = new Set();
  for (const sc of found) {
    const n = norm(sc.title);
    const hit =
      cat.find((t) => norm(t.title) === n && !takenCover.has(t.id)) ??
      cat.find((t) => (norm(t.title).includes(n) || n.includes(norm(t.title))) && !takenCover.has(t.id));
    if (hit) { takenCover.add(hit.id); matches.push({ title: sc.title, sc: sc.url, cover: hit.cover, done: false }); }
    else unmatchedSc.push(sc);
  }
  const unmatchedCovers = cat.filter((t) => !takenCover.has(t.id)).map((t) => ({ title: t.title, cover: t.cover }));

  writeFileSync(MAP_FILE, JSON.stringify({ matches, unmatchedSc, unmatchedCovers }, null, 2));
  console.log(`✓ ${matches.length} matched → ${MAP_FILE}`);
  if (unmatchedSc.length) console.log(`  ${unmatchedSc.length} SoundCloud tracks had no cover match (see unmatchedSc)`);
  if (unmatchedCovers.length) console.log(`  ${unmatchedCovers.length} covers had no SoundCloud track (see unmatchedCovers)`);
}

// ── apply: swap the artwork ──────────────────────────────────────────────────
async function prepareJpeg(url, slugish) {
  mkdirSync(TMP, { recursive: true });
  const out = join(TMP, slugish.replace(/[^\w-]+/g, "_") + ".jpg");
  if (existsSync(out)) return out;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`cover fetch ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await sharp(buf).resize(1600, 1600, { fit: "cover" }).jpeg({ quality: 92 }).toFile(out);
  return out;
}

async function apply() {
  const dry = has("--dry");
  const limit = Number(opt("--limit") ?? Infinity);
  const only = opt("--only")?.toLowerCase() ?? null;
  const map = JSON.parse(readFileSync(MAP_FILE, "utf8"));
  const todo = map.matches.filter((m) => !m.done && (!only || m.title.toLowerCase().includes(only))).slice(0, limit);
  if (!todo.length) { console.log("nothing to do — all matched tracks are done"); return; }
  console.log(`${todo.length} track(s) to update${dry ? " (dry run)" : ""}`);

  const ctx = await launch(false);
  const page = await ctx.newPage();
  let ok = 0, fail = 0;

  for (const m of todo) {
    process.stdout.write(`· ${m.title} … `);
    try {
      const jpg = await prepareJpeg(m.cover, m.title);
      if (dry) { console.log(`would upload ${jpg}`); continue; }

      await page.goto(m.sc, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      // your own track page carries an Edit button in the sound actions row
      const edit = page.locator('button:has-text("Edit")').first();
      await edit.click({ timeout: 10000 });
      const dialog = page.locator('[role="dialog"], .modal').first();
      await dialog.waitFor({ timeout: 10000 });
      // the artwork chooser is the dialog's image file input
      const input = dialog.locator('input[type="file"]').first();
      await input.setInputFiles(jpg, { timeout: 10000 });
      await page.waitForTimeout(2500); // let the preview settle / upload start
      const save = dialog.locator('button:has-text("Save change"), button:has-text("Save")').last();
      await save.click({ timeout: 10000 });
      await dialog.waitFor({ state: "hidden", timeout: 30000 });
      m.done = true;
      writeFileSync(MAP_FILE, JSON.stringify(map, null, 2)); // checkpoint every win
      ok++;
      console.log("✓");
      await page.waitForTimeout(4000); // human pace
    } catch (e) {
      fail++;
      console.log(`✗ ${String(e.message || e).split("\n")[0]}`);
    }
  }
  await ctx.close();
  console.log(`done: ${ok} updated · ${fail} failed · progress saved in soundcloud-map.json`);
}

if (has("--login")) await login();
else if (has("--scan")) await scan();
else if (has("--apply")) await apply();
else console.log("usage: --login | --scan | --apply [--dry] [--limit N] [--only <substr>]");

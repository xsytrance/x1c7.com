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
//   node scripts/song-art/soundcloud-covers.mjs --drift
//       No browser: compare each matched cover's current R2 etag against the
//       etag recorded at push time. never / stale / synced per track.
//
// Be a good citizen: it's your own account and your own art, but the script
// still moves at human pace (4s between saves) and runs headed so you can
// watch every move and slam Ctrl-C anytime.
//
// Also a LIBRARY (Cover Studio 2 P3): art-worker.mjs imports scan / drift /
// pushTracks to run `soundcloud-sync` studio jobs, and /api/studio/soundcloud
// reads the map file this writes. CLI behavior is unchanged.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = join(os.homedir(), ".cache", "soundcloud-profile");
const MAP_FILE = join(HERE, "soundcloud-map.json");
const TMP = join(os.tmpdir(), "sc-covers");

const SUPABASE_URL = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const SUPABASE_KEY = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-"; // anon, read-only
const SC_HANDLE = "rod-agenor"; // your SoundCloud profile (from /music's embed)
// SoundCloud slugs are usually the title, lowercased and hyphenated — a good
// first guess that deep-links straight to the track's page (where Edit lives).
const scSlug = (title) =>
  title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

// ── act like a human ─────────────────────────────────────────────────────────
// Nothing here moves on a metronome: pauses are drawn from ranges, the mouse
// wanders before it commits, tracks go in shuffled order, and every dozen or
// so saves the "person" gets up for a coffee. It's slower. That's the point.
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const nap = (page, lo, hi) => page.waitForTimeout(rand(lo, hi));
async function wander(page) {
  // drift the cursor through a couple of arcs, scroll like you're reading
  for (let i = 0; i < 2 + Math.floor(rand(0, 2)); i++) {
    await page.mouse.move(rand(200, 1100), rand(150, 750), { steps: Math.floor(rand(12, 30)) });
    await nap(page, 120, 600);
  }
  await page.mouse.wheel(0, rand(120, 900));
  await nap(page, 400, 1400);
  if (Math.random() < 0.4) { await page.mouse.wheel(0, -rand(80, 400)); await nap(page, 300, 900); }
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const norm = (s) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\[\](){}]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function catalog() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks?select=id,title,cover&order=sort_order.asc`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  // site-relative covers (rare) live under the public site itself
  return (await r.json()).filter((t) => t.cover)
    .map((t) => ({ ...t, cover: t.cover.startsWith("/") ? `https://x1c7.com${t.cover}` : t.cover }));
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
  console.log("→ Log in to SoundCloud in the window (Google SSO / 2FA all fine).");
  console.log("→ I'll notice by myself the moment you're in — no need to close anything.");
  const authed = () =>
    ctx.cookies("https://soundcloud.com").then((cs) => cs.some((c) => c.name === "oauth_token" && c.value)).catch(() => null); // null = browser gone
  for (let i = 0; i < 600; i++) { // up to 10 minutes of patience
    const a = await authed();
    if (a === true) {
      console.log("✓ you're in — profile saved, closing the window. Run --scan next.");
      await ctx.close().catch(() => {});
      return;
    }
    if (a === null) break; // user closed the browser — verify from disk below
    await new Promise((r) => setTimeout(r, 1000));
  }
  await ctx.close().catch(() => {});
  console.log(await checkSaved() ? "✓ profile saved — run --scan next" : "✗ never saw a login — run --login again and finish signing in");
}

/** Ground truth, no window: does the saved profile open /you/tracks without a signin bounce? */
export async function checkSaved() {
  const ctx = await launch(true);
  try {
    const page = await ctx.newPage();
    await page.goto("https://soundcloud.com/you/tracks", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3500);
    return !page.url().includes("signin");
  } catch { return false; } finally { await ctx.close().catch(() => {}); }
}

// ── scan: your tracks ↔ the catalog ─────────────────────────────────────────
export async function scan({ headless = false } = {}) {
  const cat = await catalog();
  const ctx = await launch(headless);
  const page = await ctx.newPage();
  await page.goto("https://soundcloud.com/you/tracks", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  if (page.url().includes("signin")) { await ctx.close(); throw new Error("not logged in — run --login first"); }

  // scroll until the list stops growing (the manager lazy-loads)
  let last = 0;
  for (let i = 0; i < 60; i++) {
    const n = await page.locator('a[href*="soundcloud.com/"] , a[href^="/"]').count();
    await page.mouse.wheel(0, rand(1800, 3600)); // scroll like a thumb, not a crane
    await nap(page, 900, 2100);
    if (n === last && i > 6) break;
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

  const prev = readMap(); // keep push history across rescans (done/appliedAt/etag)
  const matches = [];
  const unmatchedSc = [];
  const takenCover = new Set();
  for (const sc of found) {
    const n = norm(sc.title);
    const hit =
      cat.find((t) => norm(t.title) === n && !takenCover.has(t.id)) ??
      cat.find((t) => (norm(t.title).includes(n) || n.includes(norm(t.title))) && !takenCover.has(t.id));
    if (hit) {
      takenCover.add(hit.id);
      const old = prev?.matches?.find((m) => m.slug === hit.id || m.sc === sc.url);
      matches.push({ slug: hit.id, title: sc.title, sc: sc.url, cover: hit.cover, done: old?.done || false, ...(old?.appliedAt ? { appliedAt: old.appliedAt } : {}), ...(old?.etag ? { etag: old.etag } : {}) });
    }
    else unmatchedSc.push(sc);
  }
  const unmatchedCovers = cat.filter((t) => !takenCover.has(t.id)).map((t) => ({ slug: t.id, title: t.title, cover: t.cover }));

  writeFileSync(MAP_FILE, JSON.stringify({ scannedAt: new Date().toISOString(), matches, unmatchedSc, unmatchedCovers }, null, 2));
  console.log(`✓ ${matches.length} matched → ${MAP_FILE}`);
  if (unmatchedSc.length) console.log(`  ${unmatchedSc.length} SoundCloud tracks had no cover match (see unmatchedSc)`);
  if (unmatchedCovers.length) console.log(`  ${unmatchedCovers.length} covers had no SoundCloud track (see unmatchedCovers)`);
  return { scTracks: found.length, matched: matches.length, unmatchedSc: unmatchedSc.length, unmatchedCovers: unmatchedCovers.length };
}

export function readMap() {
  try { return JSON.parse(readFileSync(MAP_FILE, "utf8")); } catch { return null; }
}

/** Compare each matched cover's current R2 etag against the etag recorded at
 *  push time. No browser, no login — safe to call anywhere the map file lives.
 *  state per match: never (matched, not yet pushed) · stale (art changed since
 *  the push, or pre-etag push history) · synced. */
export async function drift() {
  const map = readMap();
  if (!map?.matches) return { scanned: false };
  const matches = await Promise.all(map.matches.map(async (m) => {
    let currentEtag = null;
    try { const r = await fetch(m.cover, { method: "HEAD" }); if (r.ok) currentEtag = (r.headers.get("etag") || "").replace(/"/g, "") || null; } catch { /* unreachable → can't judge, treat as synced */ }
    const state = !m.done ? "never" : currentEtag && m.etag !== currentEtag ? "stale" : "synced";
    return { ...m, currentEtag, state };
  }));
  return { scanned: true, scannedAt: map.scannedAt || null, matches, unmatchedSc: map.unmatchedSc || [], unmatchedCovers: map.unmatchedCovers || [] };
}

// ── apply: swap the artwork ──────────────────────────────────────────────────
// Always fetched fresh (a repush exists precisely because the art changed);
// the etag of what actually got pushed is returned so drift() can compare.
async function prepareJpeg(url, slugish) {
  mkdirSync(TMP, { recursive: true });
  const out = join(TMP, slugish.replace(/[^\w-]+/g, "_") + ".jpg");
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`cover fetch ${r.status}`);
  const etag = (r.headers.get("etag") || "").replace(/"/g, "") || null;
  const buf = Buffer.from(await r.arrayBuffer());
  await sharp(buf).resize(1600, 1600, { fit: "cover" }).jpeg({ quality: 92 }).toFile(out);
  return { file: out, etag };
}

/** Push covers to SoundCloud. Selection: explicit `slugs` repush even if done
 *  (that's the studio's per-track / sync-stale path); otherwise every match
 *  not yet done (the CLI's resume semantics). Progress is checkpointed into
 *  the map file after every save (done + appliedAt + pushed etag). `onItem`
 *  and `shouldStop` let art-worker report progress / honor job cancellation. */
export async function pushTracks({ slugs = null, only = null, limit = Infinity, dry = false, headless = false, onItem = null, shouldStop = null } = {}) {
  const map = readMap();
  if (!map?.matches?.length) throw new Error("no soundcloud-map.json — run a scan first");
  const todo = shuffle(map.matches.filter((m) =>
    slugs ? m.slug && slugs.includes(m.slug)
      : !m.done && (!only || m.title.toLowerCase().includes(only)))).slice(0, limit);
  const out = { total: todo.length, ok: 0, fail: 0, stopped: false, items: [] };
  if (!todo.length) { console.log("nothing to do — all matched tracks are done"); return out; }
  console.log(`${todo.length} track(s) to update${dry ? " (dry run)" : ""}`);

  const ctx = await launch(headless);
  const page = await ctx.newPage();
  let sinceBreak = 0;

  try {
    for (const m of todo) {
      if (shouldStop && (await shouldStop())) { out.stopped = true; break; }
      const item = { slug: m.slug, title: m.title, at: new Date().toISOString() };
      process.stdout.write(`· ${m.title} … `);
      try {
        const { file: jpg, etag } = await prepareJpeg(m.cover, m.slug || m.title);
        if (dry) { console.log(`would upload ${jpg}`); item.status = "dry"; }
        else {
          await page.goto(m.sc, { waitUntil: "domcontentloaded" });
          await nap(page, 2200, 5000);
          await wander(page); // look at the page like a person would
          // your own track page carries an Edit button in the sound actions row
          const edit = page.locator('button:has-text("Edit")').first();
          await edit.hover({ timeout: 10000 });
          await nap(page, 250, 900);
          await edit.click({ timeout: 10000 });
          const dialog = page.locator('[role="dialog"], .modal').first();
          await dialog.waitFor({ timeout: 10000 });
          await nap(page, 800, 2200); // read the dialog
          // the artwork chooser is the dialog's image file input
          const input = dialog.locator('input[type="file"]').first();
          await input.setInputFiles(jpg, { timeout: 10000 });
          await nap(page, 2600, 5200); // admire the new cover / let the upload run
          const save = dialog.locator('button:has-text("Save change"), button:has-text("Save")').last();
          await save.hover({ timeout: 10000 });
          await nap(page, 200, 700);
          await save.click({ timeout: 10000 });
          await dialog.waitFor({ state: "hidden", timeout: 30000 });
          m.done = true;
          m.appliedAt = new Date().toISOString();
          if (etag) m.etag = etag; else delete m.etag;
          writeFileSync(MAP_FILE, JSON.stringify(map, null, 2)); // checkpoint every win
          out.ok++;
          sinceBreak++;
          item.status = "ok";
          console.log("✓");
          await nap(page, 3500, 9000); // between-songs breath, never the same twice
          if (sinceBreak >= 10 + Math.floor(rand(0, 6))) {
            sinceBreak = 0;
            const rest = Math.round(rand(25, 70));
            console.log(`  ☕ coffee break — ${rest}s`);
            await page.waitForTimeout(rest * 1000);
          }
        }
      } catch (e) {
        out.fail++;
        item.status = "fail";
        item.error = String(e.message || e).split("\n")[0].slice(0, 200);
        console.log(`✗ ${item.error}`);
      }
      out.items.push(item);
      if (onItem) await onItem(item);
    }
  } finally {
    await ctx.close().catch(() => {});
  }
  console.log(`done: ${out.ok} updated · ${out.fail} failed · progress saved in soundcloud-map.json`);
  return out;
}

// ── prep: make the MANUAL route painless ─────────────────────────────────────
// No login, no automation against SoundCloud — just every new cover rendered
// to a 1600px JPEG named after its song in ~/Pictures/soundcloud-covers/,
// plus a checklist.html with thumbnails and tick-boxes (ticks persist in the
// browser). You drag files; nothing here touches your account.
async function prep() {
  const outDir = join(os.homedir(), "Pictures", "soundcloud-covers");
  mkdirSync(outDir, { recursive: true });
  const cat = await catalog();
  console.log(`${cat.length} covers → ${outDir}`);
  const rows = [];
  for (const t of cat) {
    const file = join(outDir, t.title.replace(/[\\/:*?"<>|]+/g, "·") + ".jpg");
    try {
      if (!existsSync(file)) {
        const r = await fetch(t.cover);
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        await sharp(Buffer.from(await r.arrayBuffer())).resize(1600, 1600, { fit: "cover" }).jpeg({ quality: 92 }).toFile(file);
      }
      rows.push({ title: t.title, file });
      process.stdout.write(".");
    } catch (e) { console.log(`\n✗ ${t.title}: ${e.message}`); }
  }
  const esc = (s) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const openBtn = (title) => {
    const track = `https://soundcloud.com/${SC_HANDLE}/${scSlug(title)}`;
    const search = `https://soundcloud.com/search?q=${encodeURIComponent(title)}`;
    // primary = guessed track page (Edit lives there); fallback = search if it 404s
    return `<a class="go" href="${track}" target="_blank">▶ open</a><a class="find" href="${search}" target="_blank">search</a>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>SoundCloud cover checklist</title>
<style>body{font:14px system-ui;background:#0d0d12;color:#eee;max-width:900px;margin:2rem auto;padding:0 1rem}
h1{font-size:18px}p{color:#999}.bar{position:sticky;top:0;background:#0d0d12;padding:8px 0;color:#8fd;border-bottom:1px solid #222}
li{display:flex;align-items:center;gap:12px;padding:7px 4px;border-bottom:1px solid #222;list-style:none}
img{width:52px;height:52px;border-radius:6px;object-fit:cover}code{color:#777;font-size:11px}input{width:18px;height:18px}
.grow{flex:1;min-width:0}b{display:block}a{font:600 12px system-ui;text-decoration:none;padding:5px 9px;border-radius:6px;white-space:nowrap}
a.go{background:#1a3;color:#0d0d12}a.find{color:#8fd;padding-left:4px}
li.done{opacity:.35}</style>
<h1>SoundCloud cover swap — ${rows.length} songs</h1>
<p>Per song: hit <b>▶ open</b> (jumps to the track) → Edit → drag the thumbnail's file in → Save → tick.
If ▶ open 404s, use <b>search</b>. Ticks survive reloads.</p>
<div class="bar" id="bar"></div>
<ul>${rows.map((r, i) => `<li id="r${i}"><input type=checkbox onchange="s(${i},this)"><img src="file://${esc(r.file)}"><div class="grow"><b>${esc(r.title)}</b><code>${esc(r.file)}</code></div>${openBtn(r.title)}</li>`).join("\n")}</ul>
<script>const K="sc-cover-ticks";const d=JSON.parse(localStorage.getItem(K)||"{}");const N=${rows.length};
function bar(){const done=Object.values(d).filter(Boolean).length;document.getElementById("bar").textContent=done+" / "+N+" done";}
for(const i in d){const li=document.getElementById("r"+i);if(li&&d[i]){li.classList.add("done");li.querySelector("input").checked=true}}
function s(i,el){d[i]=el.checked;localStorage.setItem(K,JSON.stringify(d));document.getElementById("r"+i).classList.toggle("done",el.checked);bar()}
bar();</script>`;
  const page = join(outDir, "checklist.html");
  writeFileSync(page, html);
  console.log(`\n✓ ${rows.length} JPEGs ready · checklist: ${page}`);
}

// Only run the CLI when executed directly — art-worker imports this as a lib.
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  if (has("--login")) await login();
  else if (has("--prep")) await prep();
  else if (has("--check")) console.log(await checkSaved() ? "✓ logged in" : "✗ not logged in");
  else if (has("--scan")) await scan();
  else if (has("--drift")) {
    const d = await drift();
    if (!d.scanned) console.log("no map yet — run --scan first");
    else {
      const by = (s) => d.matches.filter((m) => m.state === s);
      console.log(`scanned ${d.scannedAt || "?"} · ${by("synced").length} synced · ${by("stale").length} stale · ${by("never").length} never pushed · ${d.unmatchedSc.length}+${d.unmatchedCovers.length} unmatched`);
      for (const m of d.matches.filter((x) => x.state !== "synced")) console.log(`  ${m.state.padEnd(6)} ${m.title}`);
    }
  }
  else if (has("--apply")) await pushTracks({ dry: has("--dry"), limit: Number(opt("--limit") ?? Infinity), only: opt("--only")?.toLowerCase() ?? null });
  else console.log("usage: --login | --check | --scan | --drift | --apply [--dry] [--limit N] [--only <substr>]");
}

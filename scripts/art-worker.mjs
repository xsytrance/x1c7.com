#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ART WORKER — the GPU half of the Planet Studio app. Polls the Supabase
// art_jobs queue (filled by /api/studio/jobs), renders txt2img via local
// ComfyUI (SDXL Turbo, the amor-generate graph), uploads webp to R2, updates
// gallery.json / planet_draft.assets, and reports per-image progress so the
// phone can show each painting the moment it lands.
//
//   node scripts/art-worker.mjs            # one pass (drain the queue) — cron
//   node scripts/art-worker.mjs --watch    # loop, poll every ~10s — the daemon
//
// Job kinds (payload shapes validated by the route):
//   regenerate-base { targets:[{key,kind:"keyword"|"section",scene,label?}], style?, negative?, twins? }
//       → overwrites planets/<slug>/<key>[-2].webp in place + points
//         planet_draft.assets at them with a ?v= cache-bust
//   topup           { keys:[string|{key,scene}], perKey, style?, negative? }
//       → appends planets/<slug>/gallery/<key>-<n>.webp + rewrites gallery.json
//   oneoff          { prompt, key?, n, style?, negative?, seed? }
//       → same as topup under one bucket with a freeform prompt
//
// .env needs: SUPABASE_SERVICE_ROLE_KEY + R2 creds. ComfyUI at localhost:8188.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const HOST = process.env.COMFY_HOST || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const log = (...a) => console.error(...a);

function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...process.env, ...loadEnv(join(ROOT, ".env")) };
const PUB = (E.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, "");
const BUCKET = E.BUCKET || "x1c7-music";
const ENDPOINT = (E.ENDPOINT || "").replace(/\/$/, "");
for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT"]) if (!E[k]) { console.error(`✗ missing ${k} in .env`); process.exit(1); }

const sb = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
async function r2put(key, body, ct) { const r = await aws.fetch(`${ENDPOINT}/${BUCKET}/${encodeURI(key)}`, { method: "PUT", body, headers: { "Content-Type": ct } }); if (!r.ok) throw new Error(`R2 put ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}`); }

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const HOUSE_STYLE = "cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no watermark, no people";
const HOUSE_NEG = "person, people, face, faces, portrait, man, woman, body, hands, fingers, text, words, letters, watermark, logo, signature, cartoon, anime, low quality, blurry";

// ── ComfyUI txt2img (the amor-generate graph: 4 steps, cfg 1.0) ─────────────
function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "studio" } },
  };
}
async function comfyGenerate(prompt, negative, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, negative, seed) }) });
  if (!q.ok) throw new Error(`comfy queue ${q.status}: ${(await q.text().catch(() => "")).slice(0, 120)}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const entry = (await (await fetch(`${HOST}/history/${prompt_id}`)).json())[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0]; if (!img) throw new Error("no image");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy: " + JSON.stringify(entry.status));
  }
  throw new Error("comfy timeout");
}

// ── Manifest + row helpers ───────────────────────────────────────────────────
async function getGallery(slug) {
  try { const r = await fetch(`${PUB}/planets/${slug}/gallery.json?t=${Date.now()}`, { cache: "no-store" }); if (r.ok) { const g = await r.json(); return { slug, model: g.model || CKPT, art: g.art || {} }; } } catch { /* new */ }
  return { slug, model: CKPT, art: {} };
}
const putGallery = (g) => r2put(`planets/${g.slug}/gallery.json`, JSON.stringify(g, null, 2), "application/json");

async function getRow(slug) {
  const { data, error } = await sb.from("tracks").select("planet,planet_draft").eq("id", slug);
  if (error) throw error;
  if (!data?.[0]) throw new Error(`unknown slug ${slug}`);
  return data[0];
}
/** Point planet_draft.assets at freshly overwritten base art (?v= busts caches). */
async function updateDraftAssets(slug, entries) {
  const row = await getRow(slug);
  const draft = structuredClone(row.planet_draft ?? row.planet ?? {});
  draft.assets ??= {};
  draft.assets.keywords ??= {}; draft.assets.sections ??= {}; draft.assets.alt ??= {};
  for (const e of entries) {
    const map = e.kind === "section" ? draft.assets.sections : draft.assets.keywords;
    map[e.label] = e.url;
    if (e.twin) draft.assets.alt[e.url] = e.twin;
  }
  const { error } = await sb.from("tracks").update({ planet_draft: draft }).eq("id", slug);
  if (error) throw error;
}

// Scene lookup for topup keys the app didn't attach a prompt to.
function sceneFor(key, planet) {
  const a = planet?.analysis;
  const kw = (a?.keywords || []).find((k) => norm(k.word) === norm(key));
  if (kw?.imageryPrompt) return kw.imageryPrompt;
  const sec = (a?.sections || []).find((s) => norm(s.emotion) === norm(key));
  if (sec) return `the feeling of ${sec.emotion}, ${planet?.styleHint || ""}`;
  return `evocative scene expressing '${String(key).replace(/[-_]/g, " ")}'`;
}

// ── Job runner ───────────────────────────────────────────────────────────────
async function cancelled(id) {
  const { data } = await sb.from("art_jobs").select("status").eq("id", id);
  return data?.[0]?.status === "cancelled";
}
async function tick(job, entry) {
  await sb.from("art_jobs").update({
    done: entry.n, progress: entry.progress, updated_at: new Date().toISOString(),
  }).eq("id", job.id);
}

async function processJob(job) {
  log(`▶ art ${job.id.slice(0, 8)} · ${job.slug} · ${job.kind} · ${job.total} image(s)`);
  await sb.from("art_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", job.id);
  const p = job.payload || {};
  const row = await getRow(job.slug);
  const planet = row.planet_draft ?? row.planet ?? {};
  const style = p.style || planet.styleHint || HOUSE_STYLE;
  const negative = p.negative || HOUSE_NEG;
  const progress = Array.isArray(job.progress) ? [...job.progress] : [];
  let n = job.done || 0;

  // Build the deterministic work list, then skip what a previous run finished.
  const work = [];
  if (job.kind === "regenerate-base") {
    const twins = p.twins !== false;
    for (const t of p.targets || []) {
      const label = t.label || t.key;
      work.push({ file: `planets/${job.slug}/${t.key}.webp`, prompt: `${t.scene}, ${style}`, seed: seedOf(t.key), base: { key: t.key, kind: t.kind, label } });
      if (twins) work.push({ file: `planets/${job.slug}/${t.key}-2.webp`, prompt: `${t.scene}, alternate composition, ${style}`, seed: seedOf(t.key) + 7919, twinOf: t.key });
    }
  } else if (job.kind === "topup" || job.kind === "oneoff") {
    const gallery = await getGallery(job.slug);
    const items = job.kind === "oneoff"
      ? [{ key: p.key || "oneoff", scene: p.prompt, count: p.n || 4 }]
      : (p.keys || []).map((k) => (typeof k === "string" ? { key: k, scene: sceneFor(k, planet), count: p.perKey || 2 } : { key: k.key, scene: k.scene || sceneFor(k.key, planet), count: p.perKey || 2 }));
    for (const it of items) {
      const key = norm(it.key);
      const existing = gallery.art[key] || [];
      let maxN = 0;
      for (const u of existing) { const m = u.match(/-(\d+)\.webp$/); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); }
      for (let i = 1; i <= it.count; i++) {
        const num = maxN + i;
        const baseSeed = job.kind === "oneoff" && typeof p.seed === "number" ? p.seed : seedOf(key);
        work.push({ file: `planets/${job.slug}/gallery/${key}-${num}.webp`, prompt: `${it.scene}, ${style}`, seed: (baseSeed + 104729 * num) >>> 0, galleryKey: key });
      }
    }
  } else {
    throw new Error(`unknown kind ${job.kind}`);
  }

  const draftEntries = new Map(); // key → {kind,label,url,twin}
  const ts = Date.now();
  for (let i = 0; i < work.length; i++) {
    if (i < n) continue; // resumed job — earlier images already landed
    if (await cancelled(job.id)) { log(`  ⏹ cancelled at ${n}/${work.length}`); return; }
    const w = work[i];
    const buf = await comfyGenerate(w.prompt, negative, w.seed);
    const webp = await sharp(buf).webp({ quality: 82 }).toBuffer();
    await r2put(w.file, webp, "image/webp");

    if (w.galleryKey) {
      const gallery = await getGallery(job.slug); // re-read: reorders may have landed mid-job
      (gallery.art[w.galleryKey] ??= []).push(`/${w.file}`);
      await putGallery(gallery);
    } else if (w.base) {
      draftEntries.set(w.base.key, { kind: w.base.kind, label: w.base.label, url: `/${w.file}?v=${ts}`, twin: null });
    } else if (w.twinOf && draftEntries.has(w.twinOf)) {
      draftEntries.get(w.twinOf).twin = `/${w.file}?v=${ts}`;
    }

    n++;
    progress.push({ key: w.file.split("/").pop(), n, url: `${PUB}/${w.file}`, seed: w.seed, at: new Date().toISOString() });
    await tick(job, { n, progress });
    log(`  ✓ ${n}/${work.length} ${w.file.split("/").pop()}`);
  }

  if (draftEntries.size) await updateDraftAssets(job.slug, [...draftEntries.values()]);
  await sb.from("art_jobs").update({ status: "done", done: n, progress, updated_at: new Date().toISOString() }).eq("id", job.id);
  log(`✦ art ${job.id.slice(0, 8)} done`);
}

async function drain() {
  let done = 0;
  for (;;) {
    const { data } = await sb.from("art_jobs").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(1);
    const job = data?.[0]; if (!job) break;
    try { await processJob(job); done++; }
    catch (e) { log(`✗ art ${job.id.slice(0, 8)}: ${e.message}`); await sb.from("art_jobs").update({ status: "error", error: String(e.message).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", job.id); }
  }
  return done;
}

if (WATCH) {
  log("art-worker watching (poll ~10s)…");
  for (;;) { try { const n = await drain(); if (n) log(`(${n} processed)`); } catch (e) { log("poll error:", e.message); } await new Promise((r) => setTimeout(r, 10_000)); }
} else {
  const n = await drain();
  log(n ? `drained ${n} job(s)` : "queue empty");
}

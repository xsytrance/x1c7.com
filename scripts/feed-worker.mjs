#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// FEED WORKER — the GPU half of the gravitational feed. Polls the Supabase
// feed_jobs queue (filled by the live /studio/feed), runs img2img on the
// selected references via local ComfyUI, uploads the guided art to R2, appends
// it to guided.json, and marks the job done. Unattended — no interactive server.
//
//   node scripts/feed-worker.mjs            # one pass (drain the queue) — for cron
//   node scripts/feed-worker.mjs --watch    # loop, poll every ~45s — the daemon
//
// .env needs: SUPABASE_SERVICE_ROLE_KEY + R2 creds. ComfyUI at localhost:8188.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const HOST = "http://localhost:8188";
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
async function getGuided(slug) { try { const r = await fetch(`${PUB}/planets/${slug}/guided.json?t=${Date.now()}`, { cache: "no-store" }); if (r.ok) { const g = await r.json(); return { slug, references: g.references || [], images: g.images || [] }; } } catch { /* new */ } return { slug, references: [], images: [] }; }
async function putGuided(g) { await r2put(`planets/${g.slug}/guided.json`, JSON.stringify(g, null, 2), "application/json"); }

// ── ComfyUI img2img ────────────────────────────────────────────────────────────
async function comfyUpload(buf, name) { const fd = new FormData(); fd.append("image", new Blob([new Uint8Array(buf)]), name); fd.append("overwrite", "true"); const r = await fetch(`${HOST}/upload/image`, { method: "POST", body: fd }); if (!r.ok) throw new Error(`comfy upload ${r.status}`); const j = await r.json(); return j.subfolder ? `${j.subfolder}/${j.name}` : j.name; }
function graph(image, prompt, denoise, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "10": { class_type: "LoadImage", inputs: { image } },
    "11": { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["1", 2] } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: `${prompt}, cinematic still, moody atmospheric lighting, film grain, no text, no watermark` } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: "text, watermark, logo, caption, low quality, deformed, oversaturated, cartoon" } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["11", 0], seed, steps: 8, cfg: 1.4, sampler_name: "euler_ancestral", scheduler: "normal", denoise } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "feed" } },
  };
}
async function comfyGenerate(image, prompt, denoise, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(image, prompt, denoise, seed) }) });
  if (!q.ok) throw new Error(`comfy queue ${q.status}`);
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

async function processJob(job) {
  log(`▶ job ${job.id.slice(0, 8)} · ${job.slug} · ×${job.n} · "${job.prompt.slice(0, 50)}"`);
  await sb.from("feed_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", job.id);
  const g = await getGuided(job.slug);
  const refs = g.references.filter((r) => (job.ref_ids || []).includes(r.id));
  if (!refs.length) throw new Error("no matching references");
  const comfyNames = new Map();
  for (const r of refs) { if (comfyNames.has(r.id)) continue; const buf = Buffer.from(await (await fetch(r.url)).arrayBuffer()); comfyNames.set(r.id, await comfyUpload(buf, `${r.id}.webp`)); }
  let seed = 3_000_000 + (Date.now() % 500_000);
  for (let i = 0; i < job.n; i++) {
    const r = refs[i % refs.length];
    const buf = await comfyGenerate(comfyNames.get(r.id), job.prompt, job.denoise, seed++);
    const id = randomUUID();
    const key = `planets/${job.slug}/guided/${id}.webp`;
    await r2put(key, await sharp(buf).webp({ quality: 82 }).toBuffer(), "image/webp");
    g.images.push({ id, url: `${PUB}/${key}`, prompt: job.prompt, ref: r.url });
    await putGuided(g); // persist per image so partial progress survives
    log(`  ✓ ${i + 1}/${job.n}`);
  }
  await sb.from("feed_jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", job.id);
  log(`✦ job ${job.id.slice(0, 8)} done`);
}

async function drain() {
  let done = 0;
  for (;;) {
    const { data } = await sb.from("feed_jobs").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(1);
    const job = data?.[0]; if (!job) break;
    try { await processJob(job); done++; }
    catch (e) { log(`✗ job ${job.id.slice(0, 8)}: ${e.message}`); await sb.from("feed_jobs").update({ status: "error", error: String(e.message).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", job.id); }
  }
  return done;
}

if (WATCH) {
  log("feed-worker watching (poll ~45s)…");
  for (;;) { try { const n = await drain(); if (n) log(`(${n} processed)`); } catch (e) { log("poll error:", e.message); } await new Promise((r) => setTimeout(r, 45_000)); }
} else {
  const n = await drain();
  log(n ? `drained ${n} job(s)` : "queue empty");
}

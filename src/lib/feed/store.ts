// ═══════════════════════════════════════════════════════════════════════════
// FEED STORE (server-only) — manages a planet's guided data on R2 and drives
// ComfyUI for image-guided (img2img) generation. Used by /api/feed. Never
// imported by client code (it shells rclone + reads the R2 creds).
//
// guided.json shape (v2):
//   { slug, references: [{id,url}], images: [{id,url,prompt,ref}] }
// The show reads `images` (each an object now; old string entries normalized).
// ═══════════════════════════════════════════════════════════════════════════
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const execFileP = promisify(execFile);

export type GuidedRef = { id: string; url: string };
export type GuidedImage = { id: string; url: string; prompt?: string; ref?: string };
export type Guided = { slug: string; references: GuidedRef[]; images: GuidedImage[] };

const W = 1152, H = 832;
const HOST = process.env.COMFY_HOST || "http://localhost:8188";
const CKPT = process.env.COMFY_CKPT || "sdxl_turbo_1.0_fp16.safetensors";

// R2 creds: process.env (Next loads .env) with a direct-file fallback.
function creds() {
  const e: Record<string, string> = { ...process.env } as Record<string, string>;
  const envFile = join(process.cwd(), ".env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !e[m[1]]) e[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return e;
}
const C = creds();
export const PUB = (C.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, "");
const BUCKET = C.BUCKET || "x1c7-music";
const rcloneEnv = {
  ...process.env,
  RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: C.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: C.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: C.ENDPOINT,
};
async function r2put(localPath: string, key: string) {
  await execFileP("rclone", ["copyto", localPath, `R2:${BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv });
}
async function withTemp<T>(name: string, fn: (p: string) => Promise<T>): Promise<T> {
  const p = join(tmpdir(), `feed-${randomUUID()}-${name}`);
  try { return await fn(p); } finally { await unlink(p).catch(() => {}); }
}

// ── guided.json ───────────────────────────────────────────────────────────────
function normalize(slug: string, raw: unknown): Guided {
  const r = (raw ?? {}) as { references?: unknown[]; images?: unknown[]; feeds?: { ref?: string }[] };
  const references: GuidedRef[] = (r.references ?? []).map((x) =>
    typeof x === "string" ? { id: randomUUID(), url: x } : { id: (x as GuidedRef).id ?? randomUUID(), url: (x as GuidedRef).url }).filter((x) => x.url);
  const images: GuidedImage[] = (r.images ?? []).map((x) =>
    typeof x === "string" ? { id: randomUUID(), url: x } : { id: (x as GuidedImage).id ?? randomUUID(), url: (x as GuidedImage).url, prompt: (x as GuidedImage).prompt, ref: (x as GuidedImage).ref }).filter((x) => x.url);
  // Migrate old feed.mjs data: derive the reference library from feeds[].ref.
  if (!references.length && Array.isArray(r.feeds)) {
    const seen = new Set<string>();
    for (const f of r.feeds) if (f?.ref && !seen.has(f.ref)) { seen.add(f.ref); references.push({ id: randomUUID(), url: f.ref }); }
  }
  return { slug, references, images };
}
export async function getGuided(slug: string): Promise<Guided> {
  try {
    const res = await fetch(`${PUB}/planets/${slug}/guided.json?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) return normalize(slug, await res.json());
  } catch { /* new planet */ }
  return { slug, references: [], images: [] };
}
async function putGuided(g: Guided): Promise<Guided> {
  await withTemp("guided.json", async (p) => { await writeFile(p, JSON.stringify(g, null, 2)); await r2put(p, `planets/${g.slug}/guided.json`); });
  return g;
}

// ── ComfyUI img2img ────────────────────────────────────────────────────────────
async function comfyUpload(buf: Buffer, name: string): Promise<string> {
  const fd = new FormData();
  fd.append("image", new Blob([new Uint8Array(buf)]), name);
  fd.append("overwrite", "true");
  const r = await fetch(`${HOST}/upload/image`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`comfy upload ${r.status}`);
  const j = await r.json();
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}
function graph(image: string, prompt: string, denoise: number, steps: number, seed: number) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "10": { class_type: "LoadImage", inputs: { image } },
    "11": { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["1", 2] } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: `${prompt}, cinematic still, moody atmospheric lighting, film grain, no text, no watermark` } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: "text, watermark, logo, caption, low quality, deformed, oversaturated, cartoon" } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["11", 0], seed, steps, cfg: 1.4, sampler_name: "euler_ancestral", scheduler: "normal", denoise } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "feed" } },
  };
}
async function comfyGenerate(image: string, prompt: string, denoise: number, steps: number, seed: number): Promise<Buffer> {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(image, prompt, denoise, steps, seed) }) });
  if (!q.ok) throw new Error(`comfy queue ${q.status}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const entry = (await (await fetch(`${HOST}/history/${prompt_id}`)).json())[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy: " + JSON.stringify(entry.status));
  }
  throw new Error("comfy timeout");
}

// ── Actions ────────────────────────────────────────────────────────────────────
/** Add a reference image to the library (upload only, no generation). */
export async function addReference(slug: string, buf: Buffer): Promise<Guided> {
  const g = await getGuided(slug);
  const id = randomUUID();
  const key = `planets/${slug}/guided/refs/${id}.webp`;
  await withTemp("ref.webp", async (p) => { await sharp(buf).resize(W, H, { fit: "cover" }).webp({ quality: 82 }).toFile(p); await r2put(p, key); });
  g.references.unshift({ id, url: `${PUB}/${key}` });
  return putGuided(g);
}
export async function removeReference(slug: string, id: string): Promise<Guided> {
  const g = await getGuided(slug);
  g.references = g.references.filter((r) => r.id !== id);
  return putGuided(g);
}
export async function removeImage(slug: string, id: string): Promise<Guided> {
  const g = await getGuided(slug);
  g.images = g.images.filter((im) => im.id !== id);
  return putGuided(g);
}
export async function clearGuided(slug: string): Promise<Guided> {
  return putGuided({ slug, references: [], images: [] });
}
/** Generate `n` guided images from the SELECTED references (cycled). */
export async function generate(slug: string, refIds: string[], prompt: string, n: number, denoise: number): Promise<Guided> {
  const g = await getGuided(slug);
  const refs = refIds.length ? g.references.filter((r) => refIds.includes(r.id)) : g.references;
  if (!refs.length) throw new Error("select at least one reference to feed");
  const steps = 8;
  let seed = 3_000_000 + (Date.now() % 500_000);
  // upload each selected reference to ComfyUI once
  const comfyNames = new Map<string, string>();
  for (const r of refs) {
    if (comfyNames.has(r.id)) continue;
    const res = await fetch(r.url); const buf = Buffer.from(await res.arrayBuffer());
    comfyNames.set(r.id, await comfyUpload(buf, `${r.id}.webp`));
  }
  for (let i = 0; i < n; i++) {
    const r = refs[i % refs.length];
    const buf = await comfyGenerate(comfyNames.get(r.id)!, prompt, denoise, steps, seed++);
    const id = randomUUID();
    const key = `planets/${slug}/guided/${id}.webp`;
    await withTemp("gen.webp", async (p) => { await sharp(buf).webp({ quality: 82 }).toFile(p); await r2put(p, key); });
    g.images.push({ id, url: `${PUB}/${key}`, prompt, ref: r.url });
  }
  return putGuided(g);
}

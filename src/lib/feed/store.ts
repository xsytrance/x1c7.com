// ═══════════════════════════════════════════════════════════════════════════
// FEED STORE — manages a planet's guided.json on R2. Runs on Vercel (uses
// aws4fetch, not rclone). Pure management: references + image curation. Actual
// GENERATION happens on the home worker (needs a GPU) via the feed_jobs queue.
//
// guided.json: { slug, references:[{id,url}], images:[{id,url,prompt,ref}] }
// The show reads `images`; old string entries + feed.mjs `feeds` are normalized.
// ═══════════════════════════════════════════════════════════════════════════
import { randomUUID } from "node:crypto";
import { getJSON, putJSON, putObject, PUB } from "./r2";

export type GuidedRef = { id: string; url: string };
export type GuidedImage = { id: string; url: string; prompt?: string; ref?: string };
export type Guided = { slug: string; references: GuidedRef[]; images: GuidedImage[] };

function normalize(slug: string, raw: unknown): Guided {
  const r = (raw ?? {}) as { references?: unknown[]; images?: unknown[]; feeds?: { ref?: string }[] };
  const references: GuidedRef[] = (r.references ?? []).map((x) =>
    typeof x === "string" ? { id: randomUUID(), url: x } : { id: (x as GuidedRef).id ?? randomUUID(), url: (x as GuidedRef).url }).filter((x) => x.url);
  const images: GuidedImage[] = (r.images ?? []).map((x) =>
    typeof x === "string" ? { id: randomUUID(), url: x } : { id: (x as GuidedImage).id ?? randomUUID(), url: (x as GuidedImage).url, prompt: (x as GuidedImage).prompt, ref: (x as GuidedImage).ref }).filter((x) => x.url);
  if (!references.length && Array.isArray(r.feeds)) {
    const seen = new Set<string>();
    for (const f of r.feeds) if (f?.ref && !seen.has(f.ref)) { seen.add(f.ref); references.push({ id: randomUUID(), url: f.ref }); }
  }
  return { slug, references, images };
}

export async function getGuided(slug: string): Promise<Guided> {
  return normalize(slug, await getJSON(`planets/${slug}/guided.json`));
}
async function putGuided(g: Guided): Promise<Guided> {
  await putJSON(`planets/${g.slug}/guided.json`, g);
  return g;
}

/** Add a reference image (already downscaled client-side) to the library. */
export async function addReference(slug: string, buf: Uint8Array, ext: string): Promise<Guided> {
  const g = await getGuided(slug);
  const id = randomUUID();
  const clean = (ext || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const key = `planets/${slug}/guided/refs/${id}.${clean}`;
  await putObject(key, buf, clean === "webp" ? "image/webp" : clean === "png" ? "image/png" : "image/jpeg");
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
/** Append already-generated images (called by the worker after ComfyUI). */
export async function appendImages(slug: string, imgs: GuidedImage[]): Promise<Guided> {
  const g = await getGuided(slug);
  g.images.push(...imgs);
  return putGuided(g);
}

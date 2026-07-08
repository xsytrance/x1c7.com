// R2 access via aws4fetch (SigV4) — works in Vercel serverless (unlike rclone).
// Creds come from env (Vercel env vars in prod; .env locally, loaded by Next).
import { AwsClient } from "aws4fetch";

function envs() {
  const e = process.env as Record<string, string | undefined>;
  return {
    accessKeyId: e.ACCESS_KEY_ID || "",
    secretAccessKey: e.SECRET_ACCESS_KEY || "",
    endpoint: (e.ENDPOINT || "").replace(/\/$/, ""),
    bucket: e.BUCKET || "x1c7-music",
    pub: (e.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, ""),
  };
}

export const PUB = envs().pub;
export const objectUrl = (key: string) => `${envs().pub}/${key}`;

function client() {
  const { accessKeyId, secretAccessKey } = envs();
  return new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" });
}

export async function putObject(key: string, body: Uint8Array | string, contentType: string): Promise<void> {
  const { endpoint, bucket } = envs();
  if (!endpoint) throw new Error("R2 not configured (ENDPOINT missing)");
  const res = await client().fetch(`${endpoint}/${bucket}/${encodeURI(key)}`, {
    method: "PUT",
    body: body as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error(`R2 put ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}
export async function putJSON(key: string, obj: unknown): Promise<void> {
  await putObject(key, JSON.stringify(obj, null, 2), "application/json");
}
/** Read a JSON object from the public URL (no signing needed — bucket is public-read). */
export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`${PUB}/${encodeURI(key)}?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) return (await r.json()) as T;
  } catch { /* absent */ }
  return null;
}

/** Delete one object. A 404 counts as success (already gone). */
export async function deleteObject(key: string): Promise<void> {
  const { endpoint, bucket } = envs();
  if (!endpoint) throw new Error("R2 not configured (ENDPOINT missing)");
  const res = await client().fetch(`${endpoint}/${bucket}/${encodeURI(key)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
}

/** List keys under a prefix (signed ListObjectsV2, follows continuation pages). */
export async function listObjects(prefix: string): Promise<{ key: string; size: number }[]> {
  const { endpoint, bucket } = envs();
  if (!endpoint) throw new Error("R2 not configured (ENDPOINT missing)");
  const out: { key: string; size: number }[] = [];
  let token: string | null = null;
  do {
    const qs = new URLSearchParams({ "list-type": "2", prefix });
    if (token) qs.set("continuation-token", token);
    const res = await client().fetch(`${endpoint}/${bucket}/?${qs.toString()}`, { method: "GET" });
    if (!res.ok) throw new Error(`R2 list ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) {
      out.push({ key: m[1], size: parseInt(m[2], 10) });
    }
    token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null;
  } while (token);
  return out;
}

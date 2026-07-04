import { NextRequest, NextResponse } from "next/server";
import { isPrivateHost } from "@/lib/privateHost";
import { execFile } from "node:child_process";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const execFileP = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 300; // guided generation can take a couple minutes locally

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/feed — the gravitational feed. OWNER-ONLY: gated to private hosts
// (localhost + the owner's Tailscale), so the public site can never reach it.
// It also needs local ComfyUI + the R2 creds in .env, which the deploy lacks.
// Body: { slug, image: <data URL>, prompt, n?, denoise? }
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const hostname = (req.headers.get("host") || "").split(":")[0];
  if (!isPrivateHost(hostname)) {
    return NextResponse.json({ error: "The feed is owner-only." }, { status: 403 });
  }

  let body: { slug?: string; image?: string; prompt?: string; n?: number; denoise?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const { slug, image, prompt } = body;
  const n = Math.min(12, Math.max(1, Number(body.n) || 4));
  const denoise = Math.min(0.95, Math.max(0.2, Number(body.denoise) || 0.62));
  if (!slug || !image || !prompt) return NextResponse.json({ error: "slug, image, prompt required" }, { status: 400 });

  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(image);
  if (!m) return NextResponse.json({ error: "image must be a base64 data URL" }, { status: 400 });
  const ext = m[1].split("/")[1].replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";

  const dir = path.join(process.cwd(), "scripts/song-art/.topup-tmp");
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `feed-input-${Date.now()}.${ext}`);
  await writeFile(tmp, Buffer.from(m[2], "base64"));

  try {
    await execFileP("node", [
      "scripts/song-art/feed.mjs",
      "--slug", slug, "--image", tmp, "--prompt", prompt,
      "--n", String(n), "--denoise", String(denoise),
    ], { cwd: process.cwd(), timeout: 290_000, maxBuffer: 1 << 20 });
  } catch (e) {
    return NextResponse.json({ error: "generation failed", detail: String((e as Error).message).slice(0, 300) }, { status: 500 });
  } finally {
    await unlink(tmp).catch(() => {});
  }

  // Return the updated guided collection.
  const pub = (process.env.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, "");
  let guided: unknown = null;
  try { const r = await fetch(`${pub}/planets/${slug}/guided.json`, { cache: "no-store" }); if (r.ok) guided = await r.json(); } catch { /* R2 lag */ }
  return NextResponse.json({ ok: true, guided });
}

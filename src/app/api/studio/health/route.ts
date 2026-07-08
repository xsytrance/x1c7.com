import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/studio/health — the Planet Studio app's "am I on the grid" ping.
// Owner-gated (tailnet). Reports whether the GPU stack is up and how deep the
// art queue is, so the phone can dim generation affordances gracefully.
// ═══════════════════════════════════════════════════════════════════════════

async function up(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const comfyHost = (process.env.COMFY_HOST || "http://localhost:8188").replace(/\/$/, "");
  const ollamaHost = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const [comfy, ollama] = await Promise.all([up(`${comfyHost}/system_stats`), up(`${ollamaHost}/api/tags`)]);
  let queueDepth = 0;
  try {
    const { count } = await supabaseAdmin().from("art_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]);
    queueDepth = count ?? 0;
  } catch { /* service key absent — queue depth unknown, still healthy */ }
  return NextResponse.json({ ok: true, comfy, ollama, queueDepth });
}

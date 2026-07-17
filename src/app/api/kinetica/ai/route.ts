import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 90;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/kinetica/ai — the HOUSE KEY. Limited-time: the owner is lending
// their OpenRouter key so Kinetica's hosted site can offer cloud AI direction
// with no sign-in. The key lives ONLY here (server env); the browser talks to
// this proxy, never to OpenRouter. Free models only — tencent/hy3 first, then
// the Nemotron ladder if it's unavailable or rate-limited.
//
// Failsafes (in-memory, per instance — plenty at this traffic level):
//   · per-IP     8 requests / 10 min
//   · global     12 / min · 250 / UTC day · 2 concurrent upstream calls
//   · payload    ≤ 2 messages (system|user), ≤ 28k chars total
// A 429 here carries Retry-After and a human-readable error the client shows.
//
//   GET  → { ok, enabled }               (liveness probe for the banner)
//   POST { messages, temperature?, response_format? } → { ok, model, content }
// ═══════════════════════════════════════════════════════════════════════════

// json: does the model accept response_format {type:"json_object"}? hy3 only
// speaks json_schema, so it gets the request without response_format — the
// analysis prompt demands bare JSON and the client parser extracts the {...}
// span, so this is safe.
const MODELS: { id: string; json: boolean }[] = [
  { id: "tencent/hy3:free", json: false },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", json: true },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", json: true },
];

const ALLOWED_ORIGINS = new Set([
  "https://xsytrance.github.io", // hosted Kinetica (GitHub Pages)
  "http://localhost:5173", "http://127.0.0.1:5173", // vite dev
  "http://localhost:4173", "http://127.0.0.1:4173", // vite preview
  "tauri://localhost", "http://tauri.localhost", "https://tauri.localhost", // desktop app
]);

function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

// ── failsafe state (module-level; survives across requests on a warm instance)
const PER_IP_MAX = 8, PER_IP_WINDOW = 10 * 60_000;
const GLOBAL_PER_MIN = 12, GLOBAL_PER_DAY = 250, MAX_CONCURRENT = 2;
const ipHits = new Map<string, number[]>();
let minuteHits: number[] = [];
let day = "", dayCount = 0, inFlight = 0;

function checkLimits(ip: string): { ok: true } | { ok: false; error: string; retryAfter: number } {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= GLOBAL_PER_DAY)
    return { ok: false, error: "The house key hit its daily cap — back tomorrow, or connect your own OpenRouter key.", retryAfter: 3600 };
  minuteHits = minuteHits.filter((t) => now - t < 60_000);
  if (minuteHits.length >= GLOBAL_PER_MIN)
    return { ok: false, error: "The house key is busy right now — try again in a minute.", retryAfter: 60 };
  if (inFlight >= MAX_CONCURRENT)
    return { ok: false, error: "The house key is busy right now — try again in a moment.", retryAfter: 15 };
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW);
  if (hits.length >= PER_IP_MAX)
    return { ok: false, error: "Easy there — the house key allows a few analyses per 10 minutes. Connect your own key for more.", retryAfter: 600 };
  hits.push(now); ipHits.set(ip, hits);
  minuteHits.push(now); dayCount++;
  if (ipHits.size > 5000) { // sweep so the map can't grow unbounded
    for (const [k, v] of ipHits) if (v.every((t) => now - t >= PER_IP_WINDOW)) ipHits.delete(k);
  }
  return { ok: true };
}

interface Msg { role: string; content: string }

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { ok: true, enabled: !!process.env.OPENROUTER_DEFAULT_KEY },
    { headers: cors(req.headers.get("origin")) },
  );
}

export async function POST(req: NextRequest) {
  const headers = cors(req.headers.get("origin"));
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin))
    return NextResponse.json({ error: "origin not allowed" }, { status: 403, headers });

  const key = process.env.OPENROUTER_DEFAULT_KEY;
  if (!key)
    return NextResponse.json({ error: "The house key isn't configured right now — connect your own OpenRouter key." }, { status: 503, headers });

  let b: { messages?: Msg[]; temperature?: number; response_format?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400, headers }); }
  const messages = Array.isArray(b.messages) ? b.messages : [];
  const valid =
    messages.length >= 1 && messages.length <= 2 &&
    messages.every((m) => (m.role === "system" || m.role === "user") && typeof m.content === "string") &&
    messages.reduce((n, m) => n + m.content.length, 0) <= 28_000;
  if (!valid) return NextResponse.json({ error: "bad messages" }, { status: 400, headers });

  const ip = (req.headers.get("x-forwarded-for") ?? "anon").split(",")[0].trim();
  const gate = checkLimits(ip);
  if (!gate.ok)
    return NextResponse.json({ error: gate.error }, { status: 429, headers: { ...headers, "Retry-After": String(gate.retryAfter) } });

  inFlight++;
  try {
    let lastErr = "no free model answered";
    for (const { id: model, json } of MODELS) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://x1c7.com", "X-Title": "Kinetica (house key)" },
          body: JSON.stringify({
            model, messages,
            temperature: typeof b.temperature === "number" ? Math.max(0, Math.min(1, b.temperature)) : 0.5,
            ...(b.response_format && json ? { response_format: b.response_format } : {}),
            max_tokens: 4096,
          }),
          signal: AbortSignal.timeout(75_000),
        });
        if (!r.ok) { // unavailable / rate-limited / broken → next model in the chain
          lastErr = `${model}: ${r.status} ${(await r.text()).slice(0, 120)}`;
          continue;
        }
        const content: string = (await r.json()).choices?.[0]?.message?.content ?? "";
        if (!content) { lastErr = `${model}: empty reply`; continue; }
        return NextResponse.json({ ok: true, model, content }, { headers });
      } catch (e) {
        lastErr = `${model}: ${(e as Error).message.slice(0, 120)}`;
      }
    }
    return NextResponse.json({ error: `All free models are busy — try again shortly. (${lastErr})` }, { status: 502, headers });
  } finally {
    inFlight--;
  }
}

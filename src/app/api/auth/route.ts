import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { makeToken, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// /api/auth — the owner password gate.
//   POST { action:"status" }                     → { hasPassword }
//   POST { action:"setup", setupCode, password } → first-run set (needs SETUP_CODE)
//   POST { action:"login", password }            → verify → session cookie
//   POST { action:"logout" }                     → clear cookie
// Password hash (scrypt) lives in site_config['owner_auth']. The session cookie
// is an HMAC token signed with SESSION_SECRET.
// ═══════════════════════════════════════════════════════════════════════════
const KEY = "owner_auth";

function hashPw(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
function verifyPw(pw: string, stored: string): boolean {
  const [salt, h] = stored.split(":");
  if (!salt || !h) return false;
  const c = scryptSync(pw, salt, 64).toString("hex");
  try { return timingSafeEqual(Buffer.from(c, "hex"), Buffer.from(h, "hex")); } catch { return false; }
}
async function storedHash(): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("site_config").select("value").eq("key", KEY).maybeSingle();
  return (data?.value as { pw?: string })?.pw ?? null;
}
async function setSession(res: NextResponse) {
  const token = await makeToken(process.env.SESSION_SECRET || "");
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return res;
}

export async function POST(req: NextRequest) {
  let b: { action?: string; setupCode?: string; password?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }

  if (!process.env.SESSION_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "auth not configured (missing env vars)" }, { status: 500 });
  }

  try {
    switch (b.action) {
      case "status":
        return NextResponse.json({ hasPassword: !!(await storedHash()) });

      case "setup": {
        if (await storedHash()) return NextResponse.json({ error: "password already set — log in" }, { status: 409 });
        if (!b.setupCode || b.setupCode !== process.env.SETUP_CODE) return NextResponse.json({ error: "wrong setup code" }, { status: 403 });
        if (!b.password || b.password.length < 6) return NextResponse.json({ error: "password must be ≥ 6 chars" }, { status: 400 });
        await supabaseAdmin().from("site_config").upsert({ key: KEY, value: { pw: hashPw(b.password) }, updated_at: new Date().toISOString() });
        return setSession(NextResponse.json({ ok: true }));
      }

      case "login": {
        const stored = await storedHash();
        if (!stored) return NextResponse.json({ error: "no password set yet" }, { status: 409 });
        if (!b.password || !verifyPw(b.password, stored)) return NextResponse.json({ error: "wrong password" }, { status: 401 });
        return setSession(NextResponse.json({ ok: true }));
      }

      case "logout": {
        const res = NextResponse.json({ ok: true });
        res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
        return res;
      }

      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}

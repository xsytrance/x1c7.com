// ═══════════════════════════════════════════════════════════════════════════
// tyler.x1c7.com — the door. One route, three verbs:
//
//   GET               who am I? (and has the site been claimed yet?)
//   POST {action}     "claim" | "login" | "logout" | "change"
//
// A claim burns the one-time code Rod texted Juan and hands him the site.
// Nothing here trusts anything from the client except after it has been
// checked against the database.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  TYLER_COOKIE,
  callerIp,
  clearFailures,
  currentSession,
  hashPassword,
  isClaimed,
  mintSession,
  noteFailure,
  passwordProblem,
  rateLimited,
  sessionCookieOptions,
  usernameProblem,
  verifyPassword,
} from "@/lib/tyler/auth";

export const runtime = "nodejs"; // scrypt + timingSafeEqual are node-only
export const dynamic = "force-dynamic";

const sha256 = (s: string) => createHash("sha256").update(s.trim()).digest("hex");

const bad = (message: string, status = 400) => NextResponse.json({ ok: false, error: message }, { status });

export async function GET() {
  const session = await currentSession();
  return NextResponse.json({
    ok: true,
    claimed: await isClaimed(),
    username: session?.username ?? null,
    viaTailnet: session?.viaTailnet ?? false,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const action = body.action;
  const db = supabaseAdmin();
  const ip = await callerIp();

  // ── CLAIM — the one-time setup Juan does himself ────────────────────────
  if (action === "claim") {
    if (await isClaimed()) return bad("This site has already been set up. Sign in instead.", 409);
    if (rateLimited(ip)) return bad("Too many tries. Give it fifteen minutes.", 429);

    const { data: claim } = await db.from("tyler_claims").select("*").eq("id", "main").maybeSingle();
    if (!claim) return bad("No setup code exists yet — ask Rod to make one.", 409);
    if (claim.used_at) return bad("That setup code has already been used.", 409);
    if (sha256(body.code ?? "") !== claim.code_hash) {
      noteFailure(ip);
      return bad("That code isn't right.");
    }

    const uProblem = usernameProblem(body.username ?? "");
    if (uProblem) return bad(uProblem);
    const pProblem = passwordProblem(body.password ?? "");
    if (pProblem) return bad(pProblem);
    if (body.password !== body.confirm) return bad("The two passwords don't match.");

    const { hash, salt } = await hashPassword(body.password);
    const { error } = await db.from("tyler_admins").insert({
      username: body.username,
      pass_hash: hash,
      pass_salt: salt,
      last_login: new Date().toISOString(),
    });
    if (error) return bad("Couldn't save that account. Try again.", 500);

    await db.from("tyler_claims").update({ used_at: new Date().toISOString(), used_by: body.username }).eq("id", "main");
    clearFailures(ip);

    const jar = await cookies();
    jar.set(TYLER_COOKIE, mintSession(body.username), sessionCookieOptions);
    return NextResponse.json({ ok: true, username: body.username });
  }

  // ── LOGIN ───────────────────────────────────────────────────────────────
  if (action === "login") {
    if (rateLimited(ip)) return bad("Too many tries. Give it fifteen minutes.", 429);

    const { data: admin } = await db
      .from("tyler_admins")
      .select("*")
      .eq("username", body.username ?? "")
      .maybeSingle();

    // Same message either way — a login form should never confirm which
    // usernames exist.
    const okPassword =
      !!admin && (await verifyPassword(body.password ?? "", admin.pass_hash, admin.pass_salt));
    if (!okPassword) {
      noteFailure(ip);
      return bad("That username and password don't match.", 401);
    }

    await db.from("tyler_admins").update({ last_login: new Date().toISOString() }).eq("username", admin.username);
    clearFailures(ip);

    const jar = await cookies();
    jar.set(TYLER_COOKIE, mintSession(admin.username), sessionCookieOptions);
    return NextResponse.json({ ok: true, username: admin.username });
  }

  // ── LOGOUT ──────────────────────────────────────────────────────────────
  if (action === "logout") {
    const jar = await cookies();
    jar.set(TYLER_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return NextResponse.json({ ok: true });
  }

  // ── CHANGE username / password ──────────────────────────────────────────
  if (action === "change") {
    const session = await currentSession();
    if (!session) return bad("Sign in first.", 401);

    const { data: admin } = await db
      .from("tyler_admins")
      .select("*")
      .eq("username", session.viaTailnet ? (body.username ?? "") : session.username)
      .maybeSingle();
    if (!admin) return bad("No account to change.", 404);

    // Rod on the tailnet can reset a locked-out Juan without the old password;
    // Juan himself always proves he knows it.
    if (!session.viaTailnet) {
      const ok = await verifyPassword(body.current ?? "", admin.pass_hash, admin.pass_salt);
      if (!ok) return bad("Your current password isn't right.", 401);
    }

    const patch: Record<string, string> = {};
    if (body.password) {
      const pProblem = passwordProblem(body.password);
      if (pProblem) return bad(pProblem);
      if (body.password !== body.confirm) return bad("The two passwords don't match.");
      const { hash, salt } = await hashPassword(body.password);
      patch.pass_hash = hash;
      patch.pass_salt = salt;
    }
    if (body.newUsername && body.newUsername !== admin.username) {
      const uProblem = usernameProblem(body.newUsername);
      if (uProblem) return bad(uProblem);
      patch.username = body.newUsername;
    }
    if (!Object.keys(patch).length) return bad("Nothing to change.");

    const { error } = await db.from("tyler_admins").update(patch).eq("username", admin.username);
    if (error) return bad("Couldn't save that change.", 500);

    const finalName = patch.username ?? admin.username;
    const jar = await cookies();
    jar.set(TYLER_COOKIE, mintSession(finalName), sessionCookieOptions);
    return NextResponse.json({ ok: true, username: finalName });
  }

  return bad("Unknown action.");
}

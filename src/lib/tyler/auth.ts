// ═══════════════════════════════════════════════════════════════════════════
// tyler.x1c7.com — Juan's login. Server-only.
//
// Deliberately not Supabase Auth: Juan asked for a USERNAME, and that library
// is email-shaped. What's here is small enough to read in one sitting and has
// no dependency to keep patched — node's own crypto does the work.
//
//   password  → scrypt(password, random 16-byte salt) → 32-byte key, hex
//   session   → "<username>.<expiry>.<HMAC-SHA256(SESSION_SECRET)>" in an
//               HttpOnly + Secure + SameSite=Lax cookie
//
// Every comparison that touches a secret uses timingSafeEqual. Nothing here
// ever runs in a browser: it is imported only by /api/tyler/* route handlers.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isOwnerRequest } from "@/lib/ownerGate";

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;

export const TYLER_COOKIE = "tyler_session";
const DAYS_30 = 60 * 60 * 24 * 30;
const KEYLEN = 32;

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

/** Constant-time string compare that can't throw on a length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ── Passwords ─────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, KEYLEN);
  return { hash: key.toString("hex"), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const key = await scrypt(password, salt, KEYLEN);
  return safeEqual(key.toString("hex"), hash);
}

/**
 * The house rules for a password. Short and honest: length beats a zoo of
 * character classes, and a rule Juan can't satisfy on a phone keyboard at 1am
 * is a rule that produces "Password1!" on a sticky note.
 */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters — length is what actually protects you.";
  if (/^\d+$/.test(pw)) return "All numbers is easy to guess. Mix in some words.";
  if (/^(.)\1+$/.test(pw)) return "That's the same character over and over.";
  return null;
}

export function usernameProblem(name: string): string | null {
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(name)) {
    return "3–24 characters: letters, numbers, and . _ - only.";
  }
  return null;
}

// ── Sessions ──────────────────────────────────────────────────────────────

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function mintSession(username: string): string {
  const expiry = Date.now() + DAYS_30 * 1000;
  const payload = `${username}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** The username inside a valid, unexpired token — or null. */
export function readSession(token: string | undefined): string | null {
  if (!token) return null;
  const cut = token.lastIndexOf(".");
  if (cut < 0) return null;
  const payload = token.slice(0, cut);
  const mac = token.slice(cut + 1);
  if (!safeEqual(mac, sign(payload))) return null;
  const [username, expiry] = payload.split(".");
  if (!username || !expiry || Number(expiry) < Date.now()) return null;
  return username;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DAYS_30,
};

// ── The gate every write goes through ─────────────────────────────────────

export interface TylerSession {
  username: string;
  /** True when the caller is Rod on the tailnet rather than a logged-in Juan. */
  viaTailnet: boolean;
}

/**
 * Who is asking? Either a valid session cookie, OR the owner on the tailnet —
 * that second door is deliberate: a locked-out Juan is then a 30-second fix
 * from Rod's box instead of a database surgery.
 */
export async function currentSession(): Promise<TylerSession | null> {
  const jar = await cookies();
  const username = readSession(jar.get(TYLER_COOKIE)?.value);
  if (username) return { username, viaTailnet: false };

  const host = (await headers()).get("host");
  if (isOwnerRequest(host)) return { username: "owner", viaTailnet: true };

  return null;
}

/** Has anyone claimed the site yet? Decides whether /setup or /login shows. */
export async function isClaimed(): Promise<boolean> {
  const db = supabaseAdmin();
  const { count } = await db.from("tyler_admins").select("username", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

// ── Rate limiting ─────────────────────────────────────────────────────────
// Per-instance and in-memory, which is exactly what it claims to be: enough
// friction to make guessing pointless on a site nobody is targeting. Not a
// distributed limiter, and not pretending to be one.
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;

export function rateLimited(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.until) {
    attempts.delete(ip);
    return false;
  }
  return rec.n >= MAX_TRIES;
}

export function noteFailure(ip: string): void {
  const rec = attempts.get(ip);
  if (!rec || Date.now() > rec.until) attempts.set(ip, { n: 1, until: Date.now() + WINDOW_MS });
  else rec.n += 1;
}

export function clearFailures(ip: string): void {
  attempts.delete(ip);
}

export async function callerIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

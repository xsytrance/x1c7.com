// Owner session tokens — HMAC-signed, verifiable on both Edge (middleware) and
// Node (routes) via Web Crypto. The cookie is the whole auth: hold a valid one
// and you're the owner. Password verification lives in /api/auth (Node/scrypt).
const enc = new TextEncoder();
export const SESSION_COOKIE = "x1c7_owner";

function b64url(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(b: string): string {
  return atob(b.replace(/-/g, "+").replace(/_/g, "/"));
}
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

export async function makeToken(secret: string, days = 30): Promise<string> {
  const payload = `owner:${Date.now() + days * 86_400_000}`;
  return `${b64url(enc.encode(payload))}.${await hmac(secret, payload)}`;
}
export async function verifyToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const [p, sig] = token.split(".");
  if (!p || !sig) return false;
  let payload: string;
  try { payload = fromB64url(p); } catch { return false; }
  if (sig !== (await hmac(secret, payload))) return false;
  const exp = Number(payload.split(":")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

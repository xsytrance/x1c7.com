import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";

// Owner gate, two doors:
//   • The tailnet (prime) passes everything, as always — access IS the tailnet.
//   • The PUBLIC site now serves /studio behind a password (STUDIO_KEY env):
//     a correct key sets an HttpOnly cookie holding its SHA-256 for 30 days.
//     No STUDIO_KEY configured → the door stays owner-only (fail closed).
// The WRITE APIs (/api/studio, /api/feed, /api/import) remain tailnet-only —
// the password opens the instrument, never the pipelines.
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isOwnerRequest(req.headers.get("host"))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // ── public /studio: the password door ──
  const key = process.env.STUDIO_KEY;
  if (key) {
    const want = await sha256(key);
    if (req.cookies.get("x1c7-studio")?.value === want) return NextResponse.next();

    if (req.method === "POST") {
      const form = await req.formData().catch(() => null);
      const given = String(form?.get("key") ?? "");
      if (given && (await sha256(given)) === want) {
        const res = NextResponse.redirect(new URL(pathname, req.url), 303);
        res.cookies.set("x1c7-studio", want, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30,
          path: "/studio",
        });
        return res;
      }
      return unlockPage(true);
    }
    return unlockPage(false);
  }

  return NextResponse.redirect(new URL("/", req.url));
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A tiny unlock door in the house style — no JS, one form, posts to itself.
function unlockPage(wrong: boolean): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>studio — x1c7</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05030b;color:#d9d3ea;font-family:ui-monospace,'JetBrains Mono',Menlo,monospace}
  form{width:min(320px,86vw);border:1px solid #241b36;border-radius:14px;background:#0b0816;padding:26px;text-align:center}
  p{margin:0 0 4px;font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#8b83a6}
  h1{margin:0 0 18px;font-size:18px;letter-spacing:.2em;text-transform:uppercase;color:#fff}
  input{width:100%;box-sizing:border-box;border:1px solid ${wrong ? "#ff2440" : "#241b36"};border-radius:8px;background:#120c1e;color:#d9d3ea;font:inherit;font-size:14px;padding:11px 12px;outline:none;text-align:center;letter-spacing:.15em}
  input:focus{border-color:#43f7ff}
  button{margin-top:12px;width:100%;border:none;border-radius:999px;background:#43f7ff;color:#001016;font:inherit;font-weight:700;font-size:11px;letter-spacing:.25em;text-transform:uppercase;padding:12px;cursor:pointer}
  em{display:block;margin-top:10px;font-style:normal;font-size:10px;letter-spacing:.15em;color:#ff2440;min-height:13px}
</style></head><body>
<form method="post">
  <p>x1c7 · private door</p>
  <h1>The Studio</h1>
  <input type="password" name="key" placeholder="key" autofocus autocomplete="current-password">
  <button type="submit">Enter</button>
  <em>${wrong ? "that's not it" : ""}</em>
</form></body></html>`;
  return new NextResponse(html, { status: wrong ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const config = { matcher: ["/studio/:path*", "/api/feed/:path*", "/api/studio/:path*", "/api/import/:path*"] };

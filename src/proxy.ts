import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

// Owner gate: everything under /studio requires a valid session cookie, except
// the login page itself. Works from any device — the password replaces the old
// localhost/Tailscale check.
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/studio/login")) return NextResponse.next();

  const ok = await verifyToken(process.env.SESSION_SECRET || "", req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/studio/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/studio/:path*"] };

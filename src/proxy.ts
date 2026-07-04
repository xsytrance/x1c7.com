import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";

// Owner gate: the studio and its feed API are the owner's private door. They are
// served only from the prime box inside the tailnet (see isOwnerRequest); the
// public Vercel deployment never exposes them. No password — access IS the
// tailnet. Public visitors are quietly sent home; the API answers 404.
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isOwnerRequest(req.headers.get("host"))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = { matcher: ["/studio/:path*", "/api/feed/:path*"] };

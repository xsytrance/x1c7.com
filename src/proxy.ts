import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";

// Owner gate — the WRITE APIs only. The studio went fully public (owner's
// call, 2026-07-14): everything on that page is client-side and per-visitor
// (looks/shaders live in the visitor's own localStorage; drafts are gated on
// private hosts inside the page), so the velvet rope came off. The pipelines
// stay behind the tailnet: /api/studio, /api/feed, /api/import answer 404 on
// any public host — access IS the tailnet, no password, same as always.
export default function proxy(req: NextRequest) {
  if (isOwnerRequest(req.headers.get("host"))) return NextResponse.next();
  // API pipelines answer 404 off-tailnet; owner-only *pages* (Cover Studio)
  // quietly bounce home rather than leak an empty JSON body to a browser.
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = { matcher: ["/api/feed/:path*", "/api/studio/:path*", "/api/import/:path*", "/studio/covers"] };

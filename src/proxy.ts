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
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export const config = { matcher: ["/api/feed/:path*", "/api/studio/:path*", "/api/import/:path*"] };

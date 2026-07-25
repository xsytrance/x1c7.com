import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";

// Two jobs, in this order:
//
// 1. TYLER'S SUBDOMAIN. `tyler.x1c7.com/*` serves the `/tyler/*` tree without
//    the prefix ever appearing in the URL. The same pages also answer at
//    `x1c7.com/tyler/*`, on purpose: the site is fully testable and shippable
//    before the DNS record exists, so the subdomain is never a blocker.
//
// 2. THE OWNER GATE — the WRITE APIs only. The studio went fully public
//    (owner's call, 2026-07-14): everything on that page is client-side and
//    per-visitor (looks/shaders live in the visitor's own localStorage; drafts
//    are gated on private hosts inside the page), so the velvet rope came off.
//    The pipelines stay behind the tailnet: /api/studio, /api/feed, /api/import
//    answer 404 on any public host — access IS the tailnet, no password, same
//    as always. (Juan's own /api/tyler/* is NOT in here: his tools are public
//    by design and carry their own session cookie.)
const GATED = /^\/(api\/(feed|studio|import)(\/|$)|studio\/covers$)/;

// Paths that keep their own meaning on Tyler's host and must NOT be folded
// into /tyler: the API surface, Next's internals, and the full-show route
// (/t/madetobreak) which lives at the top level of the app for everyone.
const SHARED = /^\/(api|_next|t\/|favicon|robots|sitemap|.*\.[a-z0-9]+$)/i;

function isTylerHost(host: string): boolean {
  return host === "tyler.x1c7.com" || host.startsWith("tyler.");
}

export default function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const path = req.nextUrl.pathname;

  if (isTylerHost(host) && !SHARED.test(path) && !path.startsWith("/tyler")) {
    const url = req.nextUrl.clone();
    url.pathname = path === "/" ? "/tyler" : `/tyler${path}`;
    return NextResponse.rewrite(url);
  }

  if (GATED.test(path) && !isOwnerRequest(req.headers.get("host"))) {
    // API pipelines answer 404 off-tailnet; owner-only *pages* (Cover Studio)
    // quietly bounce home rather than leak an empty JSON body to a browser.
    if (path.startsWith("/api/")) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

// Everything except Next's own static output — the host rewrite has to see
// ordinary page requests, which the old narrow matcher never did.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { isPrivateHost } from "@/lib/privateHost";

// The owner's private door — the /studio pages and the /api/feed API. These are
// served ONLY from the prime box inside the tailnet (`tailscale serve` enforces
// tailnet-only at the network edge). The public Vercel deployment must never
// expose them. Two independent guards, either one is sufficient:
//   1. Never on Vercel      — process.env.VERCEL is set on every Vercel runtime.
//   2. Host must be private — localhost / MagicDNS / tailnet CGNAT (isPrivateHost).
// Belt-and-suspenders: (1) closes the *.vercel.app Host-spoof gap that (2) alone
// would leave; (2) covers any future non-Vercel public host.
export function isOwnerRequest(host: string | null | undefined): boolean {
  if (process.env.VERCEL) return false;
  return isPrivateHost((host ?? "").split(":")[0]); // strip :port
}

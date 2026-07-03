// Which hostnames count as "the owner's private door"? Private planets and
// The Foundry unlock on these — localhost on the box itself, plus the owner's
// Tailscale tailnet (phone → http://prime:7272 or the 100.x IP). Never a
// public hostname: x1c7.com stays public-only.
export function isPrivateHost(hostname: string): boolean {
  return (
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname) ||
    hostname === "prime" || // Tailscale MagicDNS short name of this box
    hostname.endsWith(".ts.net") || // MagicDNS full names
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(hostname) || // Tailscale CGNAT range
    hostname.startsWith("[fd7a:") // Tailscale IPv6 ULA
  );
}

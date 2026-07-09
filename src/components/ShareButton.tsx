"use client";
// Copy (or natively share) a track's /t/<slug> link — the URL whose preview
// card is the collector cover.

import { useState } from "react";

export default function ShareButton({ id, className = "", sizing = "px-3 py-2 text-xs" }: { id: string; className?: string; sizing?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/t/${id}`;
    if (navigator.share) {
      try { await navigator.share({ url }); return; } catch { /* user dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { window.prompt("Copy the link:", url); }
  };
  return (
    <button onClick={share}
      className={`rounded-sm border border-white/20 font-mono tracking-[0.14em] text-white/70 transition hover:border-white/60 hover:text-white ${sizing} ${className}`}>
      {copied ? "✓ COPIED" : "SHARE"}
    </button>
  );
}

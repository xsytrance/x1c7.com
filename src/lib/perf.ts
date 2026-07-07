"use client";

// ── PERF PROFILE ────────────────────────────────────────────────────────────
// The full show runs the same rich stagecraft on every device. On a phone that
// stagecraft — animated blur radii on giant type, two extra full-screen
// canvases at 2× DPR, a per-frame-blurred ghost chorus — overwhelms the mobile
// GPU while a desktop eats it fine. "Lite" is the phone profile: it keeps every
// effect visible but stops the per-frame RE-RASTERIZATION that phones choke on
// (frozen glow radii, dpr-1 canvases, no surface/ghost layers).
//
// Detected ONCE (device class doesn't change mid-session). The body carries a
// `perf-lite` class so CSS can freeze the animated blurs without touching JS.

import { useEffect, useState } from "react";

/** True on phones / touch tablets / low-memory devices. Overridable for testing
 *  via localStorage `x1c7-perf` = "lite" | "full". Safe to call on the client. */
export function detectLite(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const forced = localStorage.getItem("x1c7-perf");
    if (forced === "lite") return true;
    if (forced === "full") return false;
  } catch {
    /* private mode / disabled storage — fall through to auto-detect */
  }
  const mq = (q: string) => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  // The primary signal: a phone/tablet — a coarse pointer or a small viewport.
  const handheld = mq("(pointer: coarse)") || mq("(max-width: 900px)");
  // A secondary signal: genuinely low-memory hardware, even on a larger screen.
  const mem = (navigator as { deviceMemory?: number }).deviceMemory;
  const lowMem = typeof mem === "number" && mem <= 4;
  return handheld || lowMem;
}

/** Hook form: resolves after mount (so SSR renders the full markup, then the
 *  client downgrades if needed) and toggles `body.perf-lite` as a side effect. */
export function usePerfLite(): boolean {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    const on = detectLite();
    setLite(on);
    document.body.classList.toggle("perf-lite", on);
    return () => document.body.classList.remove("perf-lite");
  }, []);
  return lite;
}

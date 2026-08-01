"use client";
// THE MOTION SCHEDULER — what stops the wall melting a phone.
//
// ~60 tiles all breathing at once is not a design, it's a fire. Instead only a
// handful of tiles hold a "motion slot" at any moment, and the slots ROTATE
// through whatever is on screen. The wall shimmers — different songs waking up
// in turn — which reads better than everything moving at once AND costs a
// fraction of it.
//
// Scroll costs ZERO React renders: visibility lands in a ref, and only the slot
// rotation (every few seconds) touches state.

import { useEffect, useRef, useState, type RefObject } from "react";
import { detectLite } from "@/lib/perf";

/** how many tiles may breathe at once — fewer on phones */
const SLOTS = 6;
const SLOTS_LITE = 3;
/** how long a tile keeps its slot before handing it on */
const DWELL_MS = 7000;

export function useWallMotion(
  gridRef: RefObject<HTMLElement | null>,
  /** changes whenever the rendered tile set changes, so we re-observe */
  signature: string,
): Set<string> {
  const [active, setActive] = useState<Set<string>>(() => new Set());
  const visible = useRef<Set<string>>(new Set());
  const cursor = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState(SLOTS);

  // prefers-reduced-motion is an absolute stop. "Lite" (any phone/tablet) is
  // NOT — it only means fewer tiles breathe at once. detectLite() is true for
  // every viewport under 900px, so gating the whole mini show on it would
  // leave the wall dead for most of the audience.
  useEffect(() => {
    setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setSlots(detectLite() ? SLOTS_LITE : SLOTS);
  }, []);

  // Who is on screen. Deliberately writes to a ref — a setState here would
  // re-render the whole wall on every scroll frame.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !enabled) return;
    // captured once: the Set identity never changes, and the cleanup must not
    // read .current (it may point elsewhere by the time cleanup runs)
    const seen = visible.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.wallTile;
          if (!id) continue;
          if (e.isIntersecting) seen.add(id);
          else seen.delete(id);
        }
      },
      // Strictly what's on screen. An earlier 120px margin let tiles just
      // below the fold into the pool, and the rotation happily spent all six
      // slots on them — the wall looked dead while six tiles danced offscreen.
      { rootMargin: "0px" },
    );
    grid.querySelectorAll<HTMLElement>("[data-wall-tile]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      seen.clear();
    };
  }, [gridRef, signature, enabled]);

  // Hand the slots round.
  useEffect(() => {
    if (!enabled) { setActive(new Set()); return; }
    const rotate = () => {
      const grid = gridRef.current;
      if (!grid) return;
      // Walk the tiles in DOM order and keep the on-screen ones, so "spread
      // across the pool" means spread across the wall as the eye sees it.
      const pool: string[] = [];
      grid.querySelectorAll<HTMLElement>("[data-wall-tile]").forEach((el) => {
        const id = el.dataset.wallTile;
        if (id && visible.current.has(id)) pool.push(id);
      });
      if (pool.length === 0) { setActive((cur) => (cur.size ? new Set() : cur)); return; }

      // STRIDE, not a marching window: take every (pool/slots)-th tile so the
      // six that breathe are scattered over the whole screen instead of six
      // neighbours clumped together. The offset creeps by one each tick, so
      // the shimmer drifts across the wall rather than strobing in place.
      const take = Math.min(slots, pool.length);
      const stride = Math.max(1, Math.floor(pool.length / take));
      const next = new Set<string>();
      for (let n = 0; n < take; n++) next.add(pool[(cursor.current + n * stride) % pool.length]);
      cursor.current = (cursor.current + 1) % pool.length;
      setActive(next);
    };
    // let the first paint land before anything starts moving
    const kick = window.setTimeout(rotate, 900);
    const timer = window.setInterval(rotate, DWELL_MS);
    return () => { window.clearTimeout(kick); window.clearInterval(timer); };
  }, [enabled, slots, gridRef]);

  return active;
}

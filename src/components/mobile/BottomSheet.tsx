"use client";

// POCKET SHEET — the mobile instrument's one drawer. Three snap points
// (peek 64px / half 46dvh / full 88dvh−safe-t), dragged by the handle row,
// settled by a spring; a momentum flick can skip a level (the landing spot
// is projected from release velocity, not just position). Solid surface +
// hairline top border per the mobile chrome law — no blur, no fills.
//
// The site-wide LazyMotion ships domAnimation (no drag), so this component
// nests a LazyMotion loading domMax — framer merges lazy features, which
// makes `m.div drag` live for this subtree without fattening every page.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, animate, domMax, m, useDragControls, useMotionValue } from "framer-motion";
import { tick } from "@/lib/haptics";

export type SheetSnap = "peek" | "half" | "full";

const PEEK_H = 64;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 36 };
/** How far a flick "coasts" past the finger: y + v·0.18s picks the snap. */
const MOMENTUM_S = 0.18;

export function BottomSheet({
  snap: snapProp,
  onSnap,
  defaultSnap = "peek",
  peek,
  children,
  className = "",
}: {
  /** Controlled snap state (pass onSnap too) — omit for internal state. */
  snap?: SheetSnap;
  onSnap?: (s: SheetSnap) => void;
  defaultSnap?: SheetSnap;
  /** Always-visible row under the drag handle (tabs live here). */
  peek?: React.ReactNode;
  /** Sheet body — a render prop receives the current snap. */
  children?: React.ReactNode | ((snap: SheetSnap) => React.ReactNode);
  className?: string;
}) {
  const [internal, setInternal] = useState<SheetSnap>(snapProp ?? defaultSnap);
  const snap = snapProp ?? internal;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const sheetRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ full: 0, half: 0 });
  const y = useMotionValue(4000); // parked below the viewport until measured
  const controls = useDragControls();
  const settledOnce = useRef(false);

  const setSnap = useCallback(
    (s: SheetSnap) => {
      if (snapProp === undefined) setInternal(s);
      onSnap?.(s);
    },
    [snapProp, onSnap],
  );

  // y-offsets from the fully-open position, per snap point
  const offsets = useCallback(
    (): Record<SheetSnap, number> => ({
      full: 0,
      half: Math.max(0, dims.full - dims.half),
      peek: Math.max(0, dims.full - PEEK_H),
    }),
    [dims],
  );

  // The sheet's CSS height is calc(88dvh − safe-t); measure it (and 46dvh)
  // in px so drag math and snap targets agree with the real viewport.
  useLayoutEffect(() => {
    const measure = () => {
      const full = sheetRef.current?.offsetHeight ?? 0;
      const half = Math.round(window.innerHeight * 0.46);
      setDims((d) => (d.full === full && d.half === half ? d : { full, half }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Settle to the current snap whenever it (or the viewport) changes.
  useEffect(() => {
    if (!dims.full) return;
    const target = offsets()[snap];
    if (!settledOnce.current) {
      settledOnce.current = true;
      y.set(target); // first paint: land silently, no entrance flight
      return;
    }
    const c = animate(y, target, SPRING);
    return () => c.stop();
  }, [snap, dims, offsets, y]);

  const onDragEnd = (_e: unknown, info: { velocity: { y: number } }) => {
    const off = offsets();
    const projected = y.get() + info.velocity.y * MOMENTUM_S;
    let best: SheetSnap = "peek";
    let bestD = Infinity;
    for (const s of ["full", "half", "peek"] as const) {
      const d = Math.abs(off[s] - projected);
      if (d < bestD) { bestD = d; best = s; }
    }
    animate(y, off[best], SPRING);
    if (best !== snapRef.current) { tick(8); setSnap(best); }
  };

  return (
    <LazyMotion features={domMax} strict={false}>
      {/* scrim only above peek — tap drops the sheet back down */}
      <AnimatePresence>
        {snap !== "peek" && (
          <m.button
            key="sheet-scrim"
            aria-label="Collapse controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setSnap("peek")}
            className="fixed inset-0 z-30 bg-black/45"
          />
        )}
      </AnimatePresence>
      <m.div
        ref={sheetRef}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: Math.max(0, dims.full - PEEK_H) }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        style={{ y, bottom: "var(--player-h)", height: "calc(88dvh - var(--safe-t))", background: "rgba(12,8,22,0.94)" }}
        className={`fixed inset-x-0 z-40 flex flex-col rounded-t-2xl border-x border-t border-[var(--inst-line)] ${className}`}
        data-sheet-snap={snap}
      >
        {/* the drag surface: handle + peek row */}
        <div
          className="flex-none cursor-grab touch-none select-none active:cursor-grabbing"
          style={{ height: PEEK_H }}
          onPointerDown={(e) => controls.start(e)}
        >
          <div className="flex justify-center pb-1 pt-1.5">
            <span className="h-1 w-10 rounded-full bg-[var(--inst-line)]" />
          </div>
          {peek}
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe-b"
          style={{ maxHeight: snap === "half" ? Math.max(0, dims.half - PEEK_H) : undefined }}
        >
          {typeof children === "function" ? children(snap) : children}
        </div>
      </m.div>
    </LazyMotion>
  );
}

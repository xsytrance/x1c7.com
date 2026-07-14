"use client";

// XY PAD — the thumb's performance surface. One finger rides two params at
// once: X and Y each map across a registry param's full range (defaults:
// hue drift × bloom), written through P.set at rAF rate. A plasma trace of
// the last ~24 puck positions fades behind the finger; a 5×5 hairline grid
// gives the space landmarks, and crossing a grid line ticks the haptics.
// Long-press an axis label to point that axis at any BACKDROP float.

import { useCallback, useEffect, useRef, useState } from "react";
import { P } from "@/lib/engine/params";
import { tick } from "@/lib/haptics";

const AXES_KEY = "x1c7-xy-axes";
const DEFAULT_AXES = { x: "backdrop.hueShift", y: "backdrop.bloom" };
const TRAIL_MAX = 24;
const TRAIL_MS = 1400;

interface TrailPt { x: number; y: number; t: number }
type Axis = "x" | "y";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Where a param's current base value sits in its range, 0..1. */
const norm = (id: string) => {
  const d = P.def(id);
  if (!d || d.type !== "float") return 0.5;
  return clamp01(((P.getBase(id) as number) - d.min) / (d.max - d.min || 1));
};

export function XYPad({ className = "" }: { className?: string }) {
  const [axes, setAxes] = useState<Record<Axis, string>>(DEFAULT_AXES);
  const [puck, setPuck] = useState({ x: 0.5, y: 0.5 });
  const [trail, setTrail] = useState<TrailPt[]>([]);
  const [picker, setPicker] = useState<Axis | null>(null);

  const padRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const cell = useRef(-1); // 5×5 grid cell under the finger (haptic ticks)
  const hold = useRef(0);
  const axesRef = useRef(axes);
  axesRef.current = axes;

  // restore persisted axes, park the puck on the params' current values
  useEffect(() => {
    let a = DEFAULT_AXES;
    try {
      const raw = JSON.parse(window.localStorage.getItem(AXES_KEY) || "null") as Record<Axis, string> | null;
      if (raw?.x && raw?.y && P.def(raw.x) && P.def(raw.y)) a = { x: raw.x, y: raw.y };
    } catch { /* defaults hold */ }
    setAxes(a);
    setPuck({ x: norm(a.x), y: norm(a.y) });
  }, []);

  const assign = (axis: Axis, id: string) => {
    const next = { ...axesRef.current, [axis]: id };
    setAxes(next);
    try { window.localStorage.setItem(AXES_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setPuck({ x: norm(next.x), y: norm(next.y) });
    setPicker(null);
    tick(8);
  };

  // one write per frame, however fast the pointer streams
  const flush = useCallback(() => {
    raf.current = 0;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const a = axesRef.current;
    for (const [axis, n] of [["x", p.x], ["y", p.y]] as [Axis, number][]) {
      const d = P.def(a[axis]);
      if (d && d.type === "float") P.set(d.id, d.min + (d.max - d.min) * n, "ui");
    }
    setPuck({ x: p.x, y: p.y });
    setTrail((t) => [...t.slice(-(TRAIL_MAX - 1)), { x: p.x, y: p.y, t: performance.now() }]);
    const c = Math.min(4, Math.floor(p.x * 5)) * 5 + Math.min(4, Math.floor(p.y * 5));
    if (cell.current !== -1 && c !== cell.current) tick(8);
    cell.current = c;
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const move = (e: React.PointerEvent) => {
    const r = padRef.current?.getBoundingClientRect();
    if (!r) return;
    pending.current = {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01(1 - (e.clientY - r.top) / r.height), // up = more
    };
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };

  // the trace keeps fading after the finger lifts
  const hasTrail = trail.length > 0;
  useEffect(() => {
    if (!hasTrail) return;
    const id = window.setInterval(() => {
      const cut = performance.now() - TRAIL_MS;
      setTrail((t) => (t.length && t[0].t < cut ? t.filter((p) => p.t >= cut) : t));
    }, 150);
    return () => window.clearInterval(id);
  }, [hasTrail]);

  // long-press an axis label → reassign that axis
  const labelHold = (axis: Axis) => ({
    onPointerDown: () => {
      window.clearTimeout(hold.current);
      hold.current = window.setTimeout(() => { setPicker(axis); tick(8); }, 500);
    },
    onPointerUp: () => window.clearTimeout(hold.current),
    onPointerLeave: () => window.clearTimeout(hold.current),
  });

  const label = (id: string) => (P.def(id)?.label ?? id).toUpperCase();
  const floats = P.group("BACKDROP").filter((p) => p.type === "float");

  return (
    <div className={`relative mx-auto w-full max-w-[420px] ${className}`} data-xy-pad>
      <button
        type="button"
        {...labelHold("y")}
        title="Hold to reassign the Y axis"
        className="flex min-h-[36px] w-full items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]"
      >
        {label(axes.y)} <span className="text-[var(--inst-faint)]">↕</span>
      </button>

      <div
        ref={padRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          cell.current = -1; // no tick for the landing cell itself
          move(e);
        }}
        onPointerMove={(e) => { if (e.buttons) move(e); }}
        className="relative aspect-square min-h-[260px] w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-[var(--inst-line)]"
        style={{ background: "rgba(12,8,22,0.6)" }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <g key={i} stroke="var(--inst-line)" strokeWidth="0.35">
              <line x1={i * 20} y1={0} x2={i * 20} y2={100} />
              <line x1={0} y1={i * 20} x2={100} y2={i * 20} />
            </g>
          ))}
          {/* the plasma trace — each segment's opacity is its age */}
          {trail.slice(1).map((p, i) => {
            const q = trail[i];
            return (
              <line
                key={`${p.t}-${i}`}
                x1={q.x * 100} y1={(1 - q.y) * 100}
                x2={p.x * 100} y2={(1 - p.y) * 100}
                stroke="var(--inst-plasma)" strokeWidth="0.8" strokeLinecap="round"
                opacity={((i + 1) / trail.length) * 0.85}
              />
            );
          })}
        </svg>
        <div
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--inst-plasma)]"
          style={{
            left: `${puck.x * 100}%`,
            top: `${(1 - puck.y) * 100}%`,
            boxShadow: "0 0 12px color-mix(in srgb, var(--inst-plasma) 55%, transparent)",
          }}
        />

        {/* axis assignment — every BACKDROP float, hairline chips */}
        {picker && (
          <div className="absolute inset-0 z-10 overflow-y-auto p-3" style={{ background: "rgba(12,8,22,0.94)" }}>
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-warn)]">
              {picker === "x" ? "X ↔" : "Y ↕"} · assign
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {floats.map((p) => (
                <button
                  key={p.id}
                  onClick={() => assign(picker, p.id)}
                  className="min-h-[40px] rounded-md border px-2 text-left font-mono text-[9px] uppercase tracking-[0.12em]"
                  style={{
                    borderColor: axes[picker] === p.id ? "var(--inst-plasma)" : "var(--inst-line)",
                    color: axes[picker] === p.id ? "var(--inst-plasma)" : "var(--inst-dim)",
                    background: "var(--inst-s2)",
                  }}
                >{p.label}</button>
              ))}
            </div>
            <button
              onClick={() => setPicker(null)}
              className="mt-2 min-h-[40px] w-full rounded-md border border-[var(--inst-line)] font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--inst-faint)]"
            >Close</button>
          </div>
        )}
      </div>

      <button
        type="button"
        {...labelHold("x")}
        title="Hold to reassign the X axis"
        className="flex min-h-[36px] w-full items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)]"
      >
        {label(axes.x)} <span className="text-[var(--inst-faint)]">↔</span>
      </button>
    </div>
  );
}

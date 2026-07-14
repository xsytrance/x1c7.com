"use client";

// VIBE DIAL — looks as a rotary instrument. Every look (built-ins + the
// user's) sits as a detent on a 270° hairline arc; drag around the ring and
// the plasma tick sweeps — each detent it passes FIRES that look as a
// one-bar morph, buzzes the hand, and names itself in the center. No fills,
// no thumbs: a ring, ticks, and a needle.

import { useEffect, useRef, useState } from "react";
import { looksStore, type Look } from "@/lib/engine/looks";
import { featureBus } from "@/lib/engine/features";
import { fire as hapticFire } from "@/lib/haptics";

const A0 = 135; // arc start (bottom-left), degrees — 0° = east, y down
const SPAN = 270; // ends at 405° ≡ bottom-right; the gap faces the thumb
const R = 88;

const pt = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) };
};

const barSec = () => {
  const bpm = featureBus.F.bpm;
  return bpm > 0 ? 240 / bpm : 2.4;
};

export function VibeDial({ className = "" }: { className?: string }) {
  const [looks, setLooks] = useState<Look[]>([]);
  const [angle, setAngle] = useState(A0 + SPAN / 2);
  const [cur, setCur] = useState(-1); // last detent the needle passed
  const idx = useRef(-1);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => setLooks(looksStore.list()), []);

  const step = looks.length > 1 ? SPAN / (looks.length - 1) : SPAN;
  const detentAngle = (i: number) => (looks.length > 1 ? A0 + step * i : A0 + SPAN / 2);

  const angleFrom = (e: React.PointerEvent): number => {
    const r = svgRef.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    // the bottom gap (45°..135°) clamps to whichever end is nearer
    if (deg > 45 && deg < A0) return deg < 90 ? A0 + SPAN : A0;
    if (deg <= 45) deg += 360; // 0..45 lives past 360 on this arc
    return deg;
  };

  const ride = (e: React.PointerEvent, landing = false) => {
    if (!looks.length) return;
    const a = angleFrom(e);
    setAngle(a);
    const i = Math.max(0, Math.min(looks.length - 1, Math.round((a - A0) / step)));
    if (landing) { idx.current = i; return; } // touching down isn't a pass
    if (i !== idx.current) {
      idx.current = i;
      looksStore.fire(looks[i].id, barSec());
      hapticFire(12);
      setCur(i);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`} data-vibe-dial>
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        className="h-[200px] w-[200px] cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); ride(e, true); }}
        onPointerMove={(e) => { if (e.buttons) ride(e); }}
        role="slider"
        aria-label="Vibe dial — sweep to fire looks"
        aria-valuenow={cur}
      >
        {/* the 270° hairline ring */}
        <path
          d={`M ${pt(A0, R).x} ${pt(A0, R).y} A ${R} ${R} 0 1 1 ${pt(A0 + SPAN, R).x} ${pt(A0 + SPAN, R).y}`}
          fill="none" stroke="var(--inst-line)" strokeWidth="1"
        />
        {/* detents — one per look */}
        {looks.map((l, i) => {
          const a = detentAngle(i);
          const o = pt(a, R - 7);
          const p = pt(a, R + 7);
          const hot = i === cur;
          return (
            <line
              key={l.id}
              x1={o.x} y1={o.y} x2={p.x} y2={p.y}
              stroke={hot ? "var(--inst-plasma)" : l.id.startsWith("builtin:") ? "var(--inst-dim)" : "var(--inst-warn)"}
              strokeWidth={hot ? 2 : 1}
              opacity={hot ? 1 : 0.7}
            />
          );
        })}
        {/* the plasma needle */}
        <line
          x1={pt(angle, R - 24).x} y1={pt(angle, R - 24).y}
          x2={pt(angle, R + 7).x} y2={pt(angle, R + 7).y}
          stroke="var(--inst-plasma)" strokeWidth="2" strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--inst-plasma) 70%, transparent))" }}
        />
        <text
          x="100" y="98" textAnchor="middle"
          className="font-mono uppercase"
          style={{ fill: cur >= 0 ? "var(--inst-ink)" : "var(--inst-faint)", fontSize: 11, letterSpacing: "0.12em" }}
        >{cur >= 0 ? looks[cur]?.name.slice(0, 12) : "—"}</text>
        <text
          x="100" y="116" textAnchor="middle"
          className="font-mono uppercase"
          style={{ fill: "var(--inst-dim)", fontSize: 7, letterSpacing: "0.3em" }}
        >VIBE</text>
      </svg>
      <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-[var(--inst-faint)]">
        sweep the ring · each detent fires a look
      </p>
    </div>
  );
}

"use client";
// THE BAND — a mini visualizer for every instrument in the stems.
// Each glyph is a tiny animated musician driven by its stem's real loudness
// envelope: the mic breathes and sheds notes, the bow saws, the sticks hit,
// the trumpet blasts arcs, the piano keys press. Intensity rides a CSS var
// (--lv, 0..1) set per-frame by StemOrchestra, so fifty animated parts cost
// one style write per stem per tick — no React re-renders in the hot path.

import { useEffect, useRef } from "react";
import type { StemData, StemName } from "@/lib/stemSense";
import { envAt } from "@/lib/stemSense";
import { detectLite } from "@/lib/perf";

const S = 44; // glyph viewBox size

// Animated parts read --lv (0..1). Continuous motions (bow, strum, wave) are
// CSS keyframes whose *presence* is constant but whose amplitude/opacity is
// scaled by --lv — silence stills the band without restarting animations.
const CSS = `
@keyframes gl-bow { 0%,100% { transform: translateX(calc(var(--lv,0) * -5px)) } 50% { transform: translateX(calc(var(--lv,0) * 5px)) } }
@keyframes gl-strum { 0%,100% { transform: rotate(calc(var(--lv,0) * -14deg)) } 50% { transform: rotate(calc(var(--lv,0) * 14deg)) } }
@keyframes gl-note { 0% { transform: translateY(0); opacity: calc(0.2 + var(--lv,0) * 0.8) } 100% { transform: translateY(-9px); opacity: 0 } }
@keyframes gl-note2 { 0% { transform: translateY(0); opacity: 0 } 40% { opacity: calc(var(--lv,0) * 0.9) } 100% { transform: translateY(-11px); opacity: 0 } }
@keyframes gl-stickL { 0%,100% { transform: rotate(calc(var(--lv,0) * -22deg)) } 50% { transform: rotate(calc(var(--lv,0) * 6deg)) } }
@keyframes gl-stickR { 0%,100% { transform: rotate(calc(var(--lv,0) * 22deg)) } 50% { transform: rotate(calc(var(--lv,0) * -6deg)) } }
@keyframes gl-key1 { 0%,45%,100% { transform: translateY(0) } 55%,80% { transform: translateY(calc(var(--lv,0) * 2.5px)) } }
@keyframes gl-key2 { 0%,30%,75%,100% { transform: translateY(0) } 40%,60% { transform: translateY(calc(var(--lv,0) * 2.5px)) } }
@keyframes gl-wave { 0% { transform: translateX(0) } 100% { transform: translateX(-12px) } }
@keyframes gl-puff { 0% { transform: translateX(0) scale(0.6); opacity: calc(var(--lv,0) * 0.9) } 100% { transform: translateX(10px) scale(1.3); opacity: 0 } }
@keyframes gl-blast { 0% { transform: scale(0.5); opacity: calc(var(--lv,0) * 0.9) } 100% { transform: scale(1.5); opacity: 0 } }
@keyframes gl-shake { 0%,100% { transform: rotate(calc(var(--lv,0) * -12deg)) } 50% { transform: rotate(calc(var(--lv,0) * 12deg)) } }
@keyframes gl-twinkle { 0%,100% { opacity: calc(0.15 + var(--lv,0) * 0.5) } 50% { opacity: calc(0.3 + var(--lv,0) * 0.7) } }
.gl-body { transform-origin: 50% 60%; transform: scale(calc(0.92 + var(--lv,0) * 0.12)); transition: transform 90ms linear; }
.gl-glow { opacity: calc(var(--lv,0) * 0.85); transition: opacity 90ms linear; }
`;

function Mic({ dual = false }: { dual?: boolean }) {
  return (
    <>
      <g className="gl-body">
        {dual ? <g opacity="0.5"><rect x="12" y="14" width="7" height="11" rx="3.5" fill="currentColor" /><line x1="15.5" y1="25" x2="15.5" y2="33" stroke="currentColor" strokeWidth="2" /></g> : null}
        <rect x={dual ? 22 : 18} y="12" width="8" height="13" rx="4" fill="currentColor" />
        <path d={dual ? "M20 22 a6 6 0 0 0 12 0" : "M16 22 a6 6 0 0 0 12 0"} fill="none" stroke="currentColor" strokeWidth="1.6" />
        <line x1={dual ? 26 : 22} y1="28" x2={dual ? 26 : 22} y2="34" stroke="currentColor" strokeWidth="2" />
      </g>
      <text x="31" y="14" fontSize="8" fill="currentColor" style={{ animation: "gl-note 1.1s linear infinite" }}>♪</text>
      <text x="36" y="18" fontSize="7" fill="currentColor" style={{ animation: "gl-note2 1.5s .4s linear infinite" }}>♫</text>
    </>
  );
}

const GLYPHS: Record<StemName, () => React.ReactElement> = {
  lead: () => <Mic />,
  back: () => <Mic dual />,
  drums: () => (
    <>
      <g className="gl-body">
        <ellipse cx="22" cy="27" rx="11" ry="4" fill="currentColor" opacity="0.9" />
        <rect x="11" y="27" width="22" height="7" rx="2" fill="currentColor" opacity="0.55" />
      </g>
      <line x1="10" y1="14" x2="19" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "gl-stickL .46s ease-in-out infinite", transformOrigin: "10px 14px" }} />
      <line x1="34" y1="14" x2="25" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "gl-stickR .46s .23s ease-in-out infinite", transformOrigin: "34px 14px" }} />
      <ellipse cx="22" cy="24" rx="12" ry="4" fill="none" stroke="currentColor" strokeWidth="1.4" className="gl-glow" />
    </>
  ),
  perc: () => (
    <g className="gl-body" style={{ animation: "gl-shake .5s ease-in-out infinite", transformOrigin: "22px 30px" }}>
      <path d="M15 15 h6 l2 14 a4 3 0 0 1 -10 0 z" fill="currentColor" opacity="0.85" />
      <path d="M25 17 h5 l1.6 12 a3.4 2.6 0 0 1 -8.2 0 z" fill="currentColor" opacity="0.55" />
      <line x1="15" y1="19" x2="21.6" y2="19" stroke="#0008" strokeWidth="1" />
    </g>
  ),
  bass: () => (
    <>
      <g className="gl-body">
        <path d="M22 33 c-6 0 -8 -4 -6.5 -8 c1 -2.6 0.4 -3.4 -0.6 -5 c-1.2 -2 0 -5 3 -5 c1.8 0 2.6 0.8 4.1 0.8 c1.5 0 2.3 -0.8 4.1 -0.8 c3 0 4.2 3 3 5 c-1 1.6 -1.6 2.4 -0.6 5 c1.5 4 -0.5 8 -6.5 8 z" fill="currentColor" opacity="0.8" />
        <line x1="22" y1="8" x2="22" y2="15" stroke="currentColor" strokeWidth="2.4" />
      </g>
      <line x1="22" y1="16" x2="22" y2="32" stroke="#fff" strokeWidth="1.2" style={{ animation: "gl-bow .18s ease-in-out infinite" }} />
    </>
  ),
  synth: () => (
    <>
      <g className="gl-body">
        <rect x="10" y="24" width="24" height="9" rx="1.5" fill="currentColor" opacity="0.8" />
        {[13, 17, 21, 25, 29].map((x) => <rect key={x} x={x} y="25" width="2.6" height="5" fill="#0009" />)}
      </g>
      <g clipPath="url(#glWaveClip)">
        <path d="M6 16 q3 -6 6 0 t6 0 t6 0 t6 0 t6 0 t6 0" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ animation: "gl-wave .7s linear infinite" }} className="gl-glow" />
      </g>
      <clipPath id="glWaveClip"><rect x="10" y="8" width="24" height="14" /></clipPath>
    </>
  ),
  guitar: () => (
    <>
      <g className="gl-body">
        <circle cx="19" cy="27" r="7.5" fill="currentColor" opacity="0.8" />
        <circle cx="19" cy="27" r="2.6" fill="#0009" />
        <rect x="23" y="12" width="12" height="3" rx="1.5" transform="rotate(45 23 12)" fill="currentColor" />
      </g>
      <line x1="12" y1="27" x2="27" y2="27" stroke="#fff" strokeWidth="0.9" opacity="0.9" style={{ animation: "gl-bow .12s ease-in-out infinite" }} />
      <line x1="26" y1="20" x2="30" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "gl-strum .3s ease-in-out infinite", transformOrigin: "26px 20px" }} />
    </>
  ),
  keys: () => (
    <>
      <rect x="9" y="17" width="26" height="14" rx="1.5" fill="currentColor" opacity="0.35" className="gl-body" />
      {[10, 15, 20, 25, 30].map((x, i) => (
        <rect key={x} x={x} y="18" width="4.2" height="12" rx="0.8" fill="#fff"
          style={i === 1 || i === 3 ? { animation: `gl-key${(i % 2) + 1} .62s ease-in-out infinite` } : undefined} />
      ))}
      {[13.6, 18.6, 28.6].map((x) => <rect key={x} x={x} y="18" width="2.6" height="7" fill="#000" />)}
    </>
  ),
  strings: () => (
    <>
      <g className="gl-body">
        <path d="M22 32 c-4.5 0 -6 -3 -5 -6 c0.8 -2 0.3 -2.6 -0.5 -3.8 c-1 -1.6 0 -4 2.4 -4 c1.4 0 2 0.6 3.1 0.6 c1.1 0 1.7 -0.6 3.1 -0.6 c2.4 0 3.4 2.4 2.4 4 c-0.8 1.2 -1.3 1.8 -0.5 3.8 c1 3 -0.5 6 -5 6 z" fill="currentColor" opacity="0.85" />
        <line x1="22" y1="10" x2="22" y2="18" stroke="currentColor" strokeWidth="1.8" />
      </g>
      <line x1="12" y1="20" x2="32" y2="26" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" style={{ animation: "gl-bow .34s ease-in-out infinite" }} />
    </>
  ),
  woodwinds: () => (
    <>
      <g className="gl-body">
        <rect x="10" y="20" width="22" height="4" rx="2" transform="rotate(-12 10 20)" fill="currentColor" opacity="0.85" />
        {[15, 19, 23, 27].map((x) => <circle key={x} cx={x} cy={22.5 - (x - 10) * 0.21} r="1" fill="#0009" />)}
      </g>
      <circle cx="33" cy="15" r="2" fill="currentColor" style={{ animation: "gl-puff 1s linear infinite" }} />
      <circle cx="33" cy="17" r="1.4" fill="currentColor" style={{ animation: "gl-puff 1.3s .5s linear infinite" }} />
    </>
  ),
  brass: () => (
    <>
      <g className="gl-body">
        <path d="M10 22 h12 l7 -6 v14 l-7 -6 h-12 z" fill="currentColor" opacity="0.85" />
        {[13, 16, 19].map((x) => <rect key={x} x={x} y="18.6" width="1.6" height="4" fill="#0009" />)}
      </g>
      <path d="M31 16 a9 9 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ animation: "gl-blast .8s ease-out infinite", transformOrigin: "30px 22px" }} />
      <path d="M33 13 a13 13 0 0 1 0 18" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ animation: "gl-blast .8s .3s ease-out infinite", transformOrigin: "30px 22px" }} />
    </>
  ),
  other: () => (
    <g className="gl-body">
      {[[14, 16, 2.4, "0s"], [28, 13, 1.8, ".4s"], [22, 24, 3, ".2s"], [31, 27, 2, ".6s"], [12, 28, 1.6, ".8s"]].map(([x, y, r, d], i) => (
        <path key={i} d={`M${x} ${(y as number) - (r as number)} L${(x as number) + 0.8} ${(y as number) - 0.8} L${(x as number) + (r as number)} ${y} L${(x as number) + 0.8} ${(y as number) + 0.8} L${x} ${(y as number) + (r as number)} L${(x as number) - 0.8} ${(y as number) + 0.8} L${(x as number) - (r as number)} ${y} L${(x as number) - 0.8} ${(y as number) - 0.8} Z`}
          fill="currentColor" style={{ animation: `gl-twinkle 1.4s ${d} ease-in-out infinite` }} />
      ))}
    </g>
  ),
};

/** One animated instrument. Drive intensity by setting --lv (0..1) on a parent. */
export function InstrumentGlyph({ stem, size = 40, className = "" }: { stem: StemName; size?: number; className?: string }) {
  const Glyph = GLYPHS[stem] ?? GLYPHS.other;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width={size} height={size} className={className} aria-hidden>
      <Glyph />
    </svg>
  );
}

/**
 * THE BAND — self-driving strip of every available instrument, each animated
 * by its own stem's live envelope. `getLevel` maps a stem to 0..1 gain-aware
 * loudness; when data or playhead are missing the band idles at a soft 0.15.
 */
export function StemOrchestra({ stems, data, getTime, gainFor, onTap, size = 40, labels = true }: {
  stems: StemName[];
  data: StemData | null;
  getTime: () => number;
  gainFor?: (s: StemName) => number;
  onTap?: (s: StemName) => void;
  size?: number;
  labels?: boolean;
}) {
  const refs = useRef<Map<StemName, HTMLElement>>(new Map());

  useEffect(() => {
    let raf = 0, last = 0;
    const lite = detectLite();
    const interval = lite ? 240 : 80; // envelopes are 12.5Hz — 80ms full rate
    const tick = (ts: number) => {
      if (ts - last >= interval) {
        last = ts;
        const t = getTime();
        for (const [stem, el] of refs.current) {
          const gain = gainFor ? gainFor(stem) : 1;
          const lv = data ? Math.min(1, envAt(data, stem, t) * 1.25) * gain : 0.15;
          el.style.setProperty("--lv", lv.toFixed(3));
          el.style.opacity = gain > 0.5 ? "1" : "0.3";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, getTime, gainFor]);

  return (
    <div className="flex flex-wrap items-end justify-center gap-x-1 gap-y-2">
      <style>{CSS}</style>
      {stems.map((s) => (
        <button
          key={s}
          type="button"
          onClick={onTap ? () => onTap(s) : undefined}
          ref={(el) => { if (el) refs.current.set(s, el); else refs.current.delete(s); }}
          className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[color:var(--theme-primary,#ffd166)] transition hover:bg-white/5"
          style={{ ["--lv" as string]: 0.15 }}
          aria-label={`${s} stem`}
        >
          <InstrumentGlyph stem={s} size={size} />
          {labels ? <span className="font-mono text-[8px] uppercase tracking-widest text-white/45">{s}</span> : null}
        </button>
      ))}
    </div>
  );
}

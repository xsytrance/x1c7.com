"use client";

// THE RIDGELINE — the hero. Every measured layer on ONE time axis:
// drama band, section anatomy, per-stem energy lanes, the pulse (drum onsets),
// and the melodic contour. Canvas because a song carries ~1,100 onsets and up
// to 12 envelopes; SVG would choke.
//
// Form note: a ridgeline IS small multiples — each stem gets its own labeled
// lane. Position carries stem identity, so color is freed to encode FAMILY
// (4 validated hues) instead of cycling 12 categorical slots.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FAMILY_COLOR, fmtTime, midiToNote, type Bundle } from "@/lib/listen/types";

const PAD_L = 78;
const PAD_R = 14;
const DRAMA_H = 10;
const SECTION_H = 26;
const LANE_H = 26;
const LANE_GAP = 3;
const PULSE_H = 26;
const MELODY_H = 46;
const AXIS_H = 20;

const INK = { axis: "#71717a", label: "#a1a1aa", grid: "rgba(255,255,255,0.06)", faint: "rgba(255,255,255,0.03)" };

interface Hover { x: number; t: number }

export function Ridgeline({ bundle }: { bundle: Bundle }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover | null>(null);

  const duration = bundle.duration ?? 1;
  const stems = bundle.stems;
  const showMelody = !!bundle.melody?.words.length;
  const showPulse = bundle.has.onsets;

  const height = useMemo(() => (
    DRAMA_H + SECTION_H + stems.length * (LANE_H + LANE_GAP) +
    (showPulse ? PULSE_H : 0) + (showMelody ? MELODY_H : 0) + AXIS_H + 8
  ), [stems.length, showPulse, showMelody]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(10, width - PAD_L - PAD_R);
  const xOf = useCallback((t: number) => PAD_L + (t / duration) * plotW, [duration, plotW]);
  const tOf = useCallback((x: number) => ((x - PAD_L) / plotW) * duration, [duration, plotW]);

  // Peak-preserving decimation: one max per pixel column, so a 1-frame hit
  // never disappears between samples.
  const columns = useMemo(() => {
    if (plotW < 10) return [];
    return stems.map((s) => {
      const out = new Float32Array(Math.ceil(plotW));
      const n = s.env.length;
      for (let px = 0; px < out.length; px++) {
        const i0 = Math.floor((px / plotW) * duration * bundle.envHz);
        const i1 = Math.max(i0 + 1, Math.ceil(((px + 1) / plotW) * duration * bundle.envHz));
        let m = 0;
        for (let i = i0; i < i1 && i < n; i++) if (s.env[i] > m) m = s.env[i];
        out[px] = m;
      }
      return out;
    });
  }, [stems, plotW, duration, bundle.envHz]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 20) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";

    let y = 0;

    // ── drama band: cuts (blackouts) + risers (build-ups) ────────────────────
    for (const [s, e] of bundle.drama.cuts ?? []) {
      ctx.fillStyle = "rgba(244,63,94,0.35)";
      ctx.fillRect(xOf(s), y, Math.max(1.5, xOf(e) - xOf(s)), DRAMA_H);
    }
    for (const r of bundle.drama.risers ?? []) {
      const g = ctx.createLinearGradient(xOf(r.t), 0, xOf(r.end), 0);
      g.addColorStop(0, "rgba(245,158,11,0.10)");
      g.addColorStop(1, "rgba(245,158,11,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(xOf(r.t), y, Math.max(1.5, xOf(r.end) - xOf(r.t)), DRAMA_H);
    }
    ctx.fillStyle = INK.axis;
    ctx.textAlign = "right";
    ctx.fillText("drama", PAD_L - 8, y + DRAMA_H / 2);
    y += DRAMA_H;

    // ── section anatomy: blocks sized by real duration, intensity = opacity ──
    // (magnitude on a single neutral hue — never a categorical rainbow)
    ctx.textAlign = "left";
    for (const sec of bundle.sections) {
      if (sec.start == null || sec.end == null) continue;
      const x0 = xOf(sec.start), x1 = xOf(sec.end);
      const w = Math.max(1, x1 - x0 - 2);
      const inten = sec.intensity ?? 0.4;
      ctx.fillStyle = `rgba(228,228,231,${0.06 + inten * 0.20})`;
      ctx.fillRect(x0 + 1, y + 3, w, SECTION_H - 8);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 1.5, y + 3.5, w - 1, SECTION_H - 9);
      if (w > 34) {
        ctx.fillStyle = INK.label;
        ctx.save();
        ctx.beginPath(); ctx.rect(x0 + 4, y, w - 6, SECTION_H); ctx.clip();
        ctx.fillText(sec.name.toLowerCase(), x0 + 6, y + SECTION_H / 2);
        ctx.restore();
      }
    }
    ctx.fillStyle = INK.axis;
    ctx.textAlign = "right";
    ctx.fillText("sections", PAD_L - 8, y + SECTION_H / 2);
    y += SECTION_H;

    // vertical grid: 30s ticks + section boundaries (recessive)
    const gridTop = y;
    const gridBottom = height - AXIS_H;
    const step = duration > 420 ? 60 : 30;
    ctx.strokeStyle = INK.grid;
    ctx.lineWidth = 1;
    for (let t = step; t < duration; t += step) {
      ctx.beginPath(); ctx.moveTo(Math.round(xOf(t)) + 0.5, gridTop); ctx.lineTo(Math.round(xOf(t)) + 0.5, gridBottom); ctx.stroke();
    }
    ctx.strokeStyle = INK.faint;
    for (const b of bundle.boundaries) {
      ctx.beginPath(); ctx.moveTo(Math.round(xOf(b)) + 0.5, gridTop); ctx.lineTo(Math.round(xOf(b)) + 0.5, gridBottom); ctx.stroke();
    }

    // ── the unmeasured tail ──────────────────────────────────────────────────
    // Stem analysis often stops before the song does. Past stemsTo we know
    // NOTHING — hatch it so a flat lane never reads as "the song went quiet".
    // Only stem-derived layers are affected; melody/sections come from a
    // separate pipeline and stay valid to the end.
    const stemsTo = bundle.stemsTo;
    const gapStart = stemsTo != null && bundle.coverage != null && bundle.coverage < 0.97 ? stemsTo : null;
    const stemBlockTop = y;
    const stemBlockBottom = y + stems.length * (LANE_H + LANE_GAP) + (showPulse ? PULSE_H : 0);

    // ── stem lanes ───────────────────────────────────────────────────────────
    stems.forEach((s, si) => {
      const col = columns[si];
      const base = y + LANE_H;
      const color = FAMILY_COLOR[s.family];
      if (col) {
        ctx.beginPath();
        ctx.moveTo(PAD_L, base);
        for (let px = 0; px < col.length; px++) {
          ctx.lineTo(PAD_L + px, base - (col[px] / 99) * (LANE_H - 2));
        }
        ctx.lineTo(PAD_L + col.length, base);
        ctx.closePath();
        ctx.fillStyle = color + "8c";   // ~55% alpha fill
        ctx.fill();
        // 1px lit top edge reads the contour crisply
        ctx.beginPath();
        for (let px = 0; px < col.length; px++) {
          const yy = base - (col[px] / 99) * (LANE_H - 2);
          px === 0 ? ctx.moveTo(PAD_L, yy) : ctx.lineTo(PAD_L + px, yy);
        }
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      }
      // baseline
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.moveTo(PAD_L, base + 0.5); ctx.lineTo(PAD_L + plotW, base + 0.5); ctx.stroke();
      // direct label + family swatch (identity never by color alone)
      ctx.fillStyle = color;
      ctx.fillRect(PAD_L - 12, y + LANE_H / 2 - 3, 6, 6);
      ctx.fillStyle = INK.label;
      ctx.textAlign = "right";
      ctx.fillText(s.name, PAD_L - 18, y + LANE_H / 2);
      y += LANE_H + LANE_GAP;
    });

    // ── the pulse: kick / snare / hat onsets ─────────────────────────────────
    if (showPulse) {
      const rows: [string, number[], string][] = [
        ["kick", bundle.onsets.kicks, "#d95926"],
        ["snare", bundle.onsets.snares, "#e0e0e0"],
        ["hat", bundle.onsets.hats, "rgba(255,255,255,0.45)"],
      ];
      const rowH = PULSE_H / 3;
      rows.forEach(([, times, color], ri) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        const yy = y + ri * rowH + rowH / 2;
        ctx.beginPath();
        for (const t of times) {
          const x = Math.round(xOf(t)) + 0.5;
          ctx.moveTo(x, yy - rowH * 0.34); ctx.lineTo(x, yy + rowH * 0.34);
        }
        ctx.stroke();
      });
      ctx.fillStyle = INK.axis; ctx.textAlign = "right";
      ctx.fillText("pulse", PAD_L - 8, y + PULSE_H / 2);
      y += PULSE_H;
    }

    // hatch the unmeasured region over the stem-derived block
    if (gapStart != null) {
      const gx = xOf(gapStart);
      const gw = PAD_L + plotW - gx;
      ctx.save();
      ctx.beginPath(); ctx.rect(gx, stemBlockTop, gw, stemBlockBottom - stemBlockTop); ctx.clip();
      ctx.fillStyle = "rgba(5,5,16,0.72)";
      ctx.fillRect(gx, stemBlockTop, gw, stemBlockBottom - stemBlockTop);
      ctx.strokeStyle = "rgba(161,161,170,0.16)";
      ctx.lineWidth = 1;
      for (let d = -(stemBlockBottom - stemBlockTop); d < gw; d += 7) {
        ctx.beginPath();
        ctx.moveTo(gx + d, stemBlockBottom);
        ctx.lineTo(gx + d + (stemBlockBottom - stemBlockTop), stemBlockTop);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(245,158,11,0.7)";
      ctx.beginPath(); ctx.moveTo(Math.round(gx) + 0.5, stemBlockTop); ctx.lineTo(Math.round(gx) + 0.5, stemBlockBottom); ctx.stroke();
      if (gw > 90) {
        ctx.fillStyle = "rgba(245,158,11,0.85)";
        ctx.textAlign = "left";
        ctx.fillText("no stem data", gx + 6, stemBlockTop + 10);
      }
    }

    // ── melodic contour: pitch per sung word, opacity = confidence ───────────
    if (showMelody && bundle.melody) {
      const words = bundle.melody.words;
      const midis = words.map((w) => w.midi);
      const lo = Math.min(...midis), hi = Math.max(...midis);
      const span = Math.max(1, hi - lo);
      const yFor = (m: number) => y + MELODY_H - 6 - ((m - lo) / span) * (MELODY_H - 14);
      for (const w of words) {
        const a = 0.25 + Math.min(1, w.conf * 2.2) * 0.6;  // low confidence renders faint, never hidden
        ctx.fillStyle = `rgba(144,133,233,${a})`;
        ctx.beginPath();
        ctx.arc(xOf(w.t), yFor(w.midi), 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = INK.axis; ctx.textAlign = "right";
      ctx.fillText("melody", PAD_L - 8, y + MELODY_H / 2);
      ctx.fillStyle = "rgba(161,161,170,0.6)";
      ctx.textAlign = "left";
      ctx.fillText(midiToNote(hi), PAD_L + 3, y + 7);
      ctx.fillText(midiToNote(lo), PAD_L + 3, y + MELODY_H - 7);
      y += MELODY_H;
    }

    // ── time axis ────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(PAD_L, y + 0.5); ctx.lineTo(PAD_L + plotW, y + 0.5); ctx.stroke();
    ctx.fillStyle = INK.axis; ctx.textAlign = "center";
    for (let t = 0; t <= duration; t += step) {
      const x = xOf(t);
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, y); ctx.lineTo(Math.round(x) + 0.5, y + 4); ctx.stroke();
      ctx.fillText(fmtTime(t), x, y + 12);
    }

    // ── crosshair ────────────────────────────────────────────────────────────
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(hover.x) + 0.5, 0);
      ctx.lineTo(Math.round(hover.x) + 0.5, height - AXIS_H + 4);
      ctx.stroke();
    }
  }, [bundle, width, height, columns, stems, plotW, xOf, hover, duration, showMelody, showPulse]);

  // ── the moment finder: what is happening at the cursor ─────────────────────
  const readout = useMemo(() => {
    if (!hover) return null;
    const t = Math.max(0, Math.min(duration, hover.t));
    const i = Math.round(t * bundle.envHz);
    const section = bundle.sections.find((s) => s.start != null && s.end != null && t >= s.start && t < s.end);
    const active = stems
      .map((s) => ({ name: s.name, family: s.family, v: s.env[i] ?? 0 }))
      .filter((s) => s.v > 3)
      .sort((a, b) => b.v - a.v);
    let note: string | null = null;
    if (bundle.melody?.words.length) {
      const w = bundle.melody.words.reduce((best, cur) =>
        Math.abs(cur.t - t) < Math.abs(best.t - t) ? cur : best);
      if (Math.abs(w.t - t) < 1.2) note = `${midiToNote(w.midi)}`;
    }
    const unmeasured = bundle.stemsTo != null && bundle.coverage != null && bundle.coverage < 0.97 && t > bundle.stemsTo;
    return { t, section, active, note, unmeasured };
  }, [hover, bundle, stems, duration]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height }}
        className="block cursor-crosshair"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - r.left;
          if (x < PAD_L || x > PAD_L + plotW) { setHover(null); return; }
          setHover({ x, t: tOf(x) });
        }}
        onMouseLeave={() => setHover(null)}
      />
      {hover && readout && (
        <div
          className="pointer-events-none absolute z-10 w-[210px] rounded-lg border border-zinc-700 bg-[#0b0b16]/95 p-2.5 shadow-xl"
          style={{ left: Math.min(Math.max(hover.x + 12, 0), Math.max(0, width - 220)), top: 6 }}
        >
          <p className="font-mono text-[11px] text-zinc-100">{fmtTime(readout.t)}</p>
          {readout.section && (
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {readout.section.name}
              {readout.section.intensity != null && <span className="text-zinc-600"> · intensity {Math.round(readout.section.intensity * 100)}</span>}
            </p>
          )}
          {readout.note && <p className="mt-0.5 font-mono text-[11px] text-[#9085e9]">♪ {readout.note}</p>}
          <div className="mt-1.5 space-y-0.5">
            {readout.unmeasured && <p className="font-mono text-[10px] text-amber-400">no stem data here<br /><span className="text-zinc-600">stems end at {fmtTime(bundle.stemsTo ?? 0)}</span></p>}
            {!readout.unmeasured && readout.active.length === 0 && <p className="font-mono text-[10px] text-zinc-600">— silence —</p>}
            {!readout.unmeasured && readout.active.slice(0, 6).map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ background: FAMILY_COLOR[s.family] }} />
                <span className="font-mono text-[10px] text-zinc-400">{s.name}</span>
                <span className="ml-auto font-mono text-[10px] text-zinc-500">{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SURFACE LAYER — a physics class the weather engine can't express.
// Airborne particles fall THROUGH the air; surface effects CLING to the glass
// and creep IN from the edges: mud rising up a wall, rust blooming from the
// corners, cracks spidering across the frame, condensation beading and sliding,
// vines reclaiming the screen. It grows over time, scaled by the section's
// intensity, and sits BETWEEN the backdrop and the words.
//
// Plain canvas 2D + one rAF. Patches live in a ref; zero React re-renders.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import { SURFACE_SPECS, type SurfaceMode } from "@/lib/effects/registry";

type Edge = "bottom" | "top" | "left" | "right";
type Patch = {
  x: number; y: number;          // seed anchor (on/near an edge)
  r: number; maxR: number; grow: number;
  color: string; edge: Edge;
  path?: { x: number; y: number }[]; // for crack / tendril forms
  prog: number;                       // 0..1 reveal for path forms
  seed: number;
};

export function SurfaceEffects({ mode, intensity, scale = 1 }: {
  mode: SurfaceMode;
  /** 0..1 — the section's intensity sets how far the growth reaches. */
  intensity: number;
  /** density multiplier (phrase mode runs lighter). */
  scale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patches = useRef<Patch[]>([]);
  // Clamp to the documented 0..1 — a section's live intensity can dip outside
  // it, and a negative value here becomes a negative gradient radius (a thrown
  // IndexSizeError in the rAF, caught live on the kinetica demo).
  const emo = useRef(Math.max(0, Math.min(1, intensity)));
  emo.current = Math.max(0, Math.min(1, intensity));
  const modeRef = useRef(mode);

  // Mode switch: let the old growth recede, then regrow in the new material.
  useEffect(() => {
    if (modeRef.current !== mode) { patches.current = []; modeRef.current = mode; }
  }, [mode]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spec = () => SURFACE_SPECS[modeRef.current];

    const seed = (): Patch => {
      const s = spec();
      const edge = s.from[(Math.random() * s.from.length) | 0];
      let x = 0, y = 0;
      if (edge === "bottom") { x = Math.random() * w; y = h; }
      else if (edge === "top") { x = Math.random() * w; y = 0; }
      else if (edge === "left") { x = 0; y = Math.random() * h; }
      else { x = w; y = Math.random() * h; }
      const reach = (0.06 + emo.current * 0.16) * Math.min(w, h);
      const maxR = reach * (0.5 + Math.random());
      const color = s.colors[(Math.random() * s.colors.length) | 0];
      const p: Patch = { x, y, r: 0, maxR, grow: maxR * (0.14 + Math.random() * 0.16), color, edge, prog: 0, seed: Math.random() };
      if (s.form === "crack" || s.form === "tendril") p.path = growPath(edge, x, y, maxR * (s.form === "crack" ? 3.4 : 2.6), s.form);
      return p;
    };

    // an inward, jittering path for cracks (angular) or tendrils (curvy)
    function growPath(edge: Edge, x0: number, y0: number, len: number, form: "crack" | "tendril"): { x: number; y: number }[] {
      const inward = edge === "bottom" ? -Math.PI / 2 : edge === "top" ? Math.PI / 2 : edge === "left" ? 0 : Math.PI;
      const pts = [{ x: x0, y: y0 }];
      let a = inward, x = x0, y = y0;
      const steps = form === "crack" ? 7 : 12;
      for (let i = 0; i < steps; i++) {
        a += (Math.random() - 0.5) * (form === "crack" ? 1.0 : 0.6);
        const step = len / steps;
        x += Math.cos(a) * step; y += Math.sin(a) * step;
        pts.push({ x, y });
      }
      return pts;
    }

    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (document.hidden) return;
      const s = spec();
      const arr = patches.current;
      const target = Math.round((10 + emo.current * 46) * scale);
      while (arr.length < target) arr.push(seed());
      if (arr.length > target + 6) arr.splice(0, arr.length - target);

      ctx.clearRect(0, 0, w, h);
      for (const p of arr) {
        p.r = Math.min(p.maxR, p.r + p.grow * dt);
        p.prog = Math.min(1, p.prog + dt * 0.4);
        if (p.path) drawPath(ctx, p, s.form);
        else drawSplotch(ctx, p, s.form);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [scale]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[1]" aria-hidden />;
}

// A soft dome of material creeping in from an edge (mud, rust, moss, sand),
// or a beading droplet (condensation, blood) that occasionally slides.
function drawSplotch(ctx: CanvasRenderingContext2D, p: Patch, form: string) {
  const droplet = form === "droplet";
  // nudge the center just OUTSIDE the edge so only the creeping front shows
  let cx = p.x, cy = p.y;
  const off = p.r * 0.4;
  if (p.edge === "bottom") cy += off;
  else if (p.edge === "top") cy -= off;
  else if (p.edge === "left") cx -= off;
  else cx += off;

  const r = droplet ? p.r * 0.5 : p.r;
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, p.color);
  g.addColorStop(0.6, hexA(p.color, droplet ? 0.5 : 0.7));
  g.addColorStop(1, hexA(p.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();

  // irregular lobes so the front isn't a clean circle
  const lobes = 3;
  for (let i = 0; i < lobes; i++) {
    const a = p.seed * 6.28 + (i / lobes) * 6.28;
    const lx = cx + Math.cos(a) * r * 0.55, ly = cy + Math.sin(a) * r * 0.55;
    const lr = r * (0.35 + ((p.seed * (i + 3)) % 1) * 0.3);
    const lg = ctx.createRadialGradient(lx, ly, lr * 0.1, lx, ly, lr);
    lg.addColorStop(0, hexA(p.color, 0.8)); lg.addColorStop(1, hexA(p.color, 0));
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 7); ctx.fill();
  }

  // droplets sometimes leave a downward slide-trail
  if (droplet && p.seed > 0.6) {
    const trail = ctx.createLinearGradient(cx, cy, cx, cy + r * 3);
    trail.addColorStop(0, hexA(p.color, 0.4)); trail.addColorStop(1, hexA(p.color, 0));
    ctx.fillStyle = trail;
    ctx.fillRect(cx - r * 0.12, cy, r * 0.24, r * 3 * p.prog);
  }
}

// A spidering crack or a creeping vine, revealed along its path over time.
function drawPath(ctx: CanvasRenderingContext2D, p: Patch, form: string) {
  const pts = p.path!;
  const shown = Math.max(2, Math.floor(pts.length * p.prog));
  const vine = form === "tendril";
  ctx.save();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = vine ? 2.4 : 1.4;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < shown; i++) {
    if (vine) {
      const prev = pts[i - 1];
      const mx = (prev.x + pts[i].x) / 2, my = (prev.y + pts[i].y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    } else {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  }
  ctx.stroke();
  // vine leaves / crack sub-splinters
  for (let i = 2; i < shown; i += 2) {
    const q = pts[i];
    if (vine) {
      ctx.fillStyle = hexA(p.color, 0.7);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 4.5, 2.6, p.seed * 6.28 + i, 0, 7); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x + (p.seed - 0.5) * 16, q.y + (((i * 7) % 10) - 5));
      ctx.stroke();
    }
  }
  ctx.restore();
}

// #rrggbb → rgba() with alpha (registry colors are all 6-digit hex).
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

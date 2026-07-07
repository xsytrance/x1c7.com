"use client";

// The weather layer — a full-screen canvas of song-matched particles (embers,
// rain, snow, dust, bubbles, sparks) that sits BETWEEN the backdrop painting
// and the words. It breathes with the section's intensity, pulses on the live
// beat, and reacts to the listener: taps burst it, swipes drag comet trails
// through it, blow-gusts sweep it sideways, shakes rattle it.
// Plain canvas 2D + one rAF: zero React re-renders while running.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { beatClock } from "@/lib/beatClock";

export type ParticleMode =
  | "embers" | "rain" | "snow" | "dust" | "bubbles" | "sparks"
  | "ash" | "petals" | "pollen"
  // Pick-only weather (no automatic song match — surfaced in the Director's
  // weather picker so a vibe can choose them deliberately).
  | "fireflies" | "confetti" | "leaves" | "stars";

/** Every weather mode, in picker order — the single list the Director's weather
 *  dropdown and vibe builder render (so they can't drift from the union). */
export const ALL_PARTICLE_MODES: ParticleMode[] = [
  "dust", "embers", "ash", "rain", "snow", "bubbles", "sparks", "petals", "pollen",
  "fireflies", "confetti", "leaves", "stars",
];

/** Pick a song's weather from its planet vocabulary. Ash (falling, grey, spent)
 * is checked BEFORE embers (rising, hot) so "ashes of regret" reads cold, not
 * on-fire. Order = priority; first match wins. */
export function particleModeFor(text: string): ParticleMode {
  const t = text.toLowerCase();
  if (/\b(ash|ashes|cinder|cinders|smoulder|smolder|charred|burnt|soot|embers? fall)\b/.test(t)) return "ash";
  if (/fire|burn|flame|ember|match|blaze|spark(?!le)/.test(t)) return "embers";
  if (/rain|storm|river|ocean|water|sea\b|tide|lluvia|mar\b|drown|flood|tear(s|drop)?/.test(t)) return "rain";
  if (/snow|winter|frost|cold|ice|nieve|freeze|frozen|blizzard/.test(t)) return "snow";
  if (/glitch|static|signal|wi-?fi|data|code|server|digital|circuit|neon/.test(t)) return "sparks";
  if (/champagne|cocktail|drink|bubble|party|fizz|celebra|toast|club|dance floor/.test(t)) return "bubbles";
  if (/rose|petal|bloom|blossom|flower|garden|romance|amor|valentine/.test(t)) return "petals";
  if (/pollen|meadow|field|dandelion|wheat|honey|golden|sunlit|hazy|summer/.test(t)) return "pollen";
  return "dust";
}

export type ParticleHandle = {
  /** Radial burst of extra particles from a point (tap, firework, milestone). */
  burst: (x: number, y: number, n?: number) => void;
  /** Comet trail: seed particles along a swipe with the finger's velocity. */
  trail: (x: number, y: number, vx: number, vy: number) => void;
  /** A horizontal wind gust sweeps everything (blow moments). +1 = rightward. */
  gust: (dir?: number) => void;
  /** Shake: jolt every particle with random velocity. */
  quake: () => void;
  /** Sparkle n random particles for a moment (hi-hat glints). */
  glint: (n?: number) => void;
  /** Pull everything toward the center (riser charge-up). 0..1 strength. */
  implode: (strength: number) => void;
  /** Freeze/unfreeze ambient motion (beat-cut blackouts). */
  freeze: (on: boolean) => void;
};

type P = {
  x: number; y: number; vx: number; vy: number;
  r: number; a: number; hue: string; life: number; maxLife: number;
  wobble: number; extra?: boolean; glint?: number;
};

const WARM = ["#ffd28a", "#ff8a3c", "#ff5400", "#ffb35c"];
const ASH = ["#cbc6be", "#9a938a", "#6f6a63", "#d8b48a"]; // greys + one faint spent ember
const PETAL = ["#ffb7c5", "#ff8fab", "#ffd1dc", "#e75480"];
const GOLD = ["#ffe08a", "#ffd35c", "#fff0b8", "#f7c948"];
const FIREFLY = ["#eaff8a", "#c8ff6a", "#a8ffcf", "#fff6a8"]; // warm glow-green/yellow
const CONFETTI = ["#ff4d6d", "#4dd2ff", "#ffd84d", "#8aff6a", "#c86aff", "#ff8a3c"];
const LEAF = ["#c9822f", "#a85a2c", "#e0a54a", "#7a3b18", "#d4741f"]; // autumn
const STAR = ["#ffffff", "#dfeaff", "#bcd4ff", "#fff4d6"];

const DENSITY: Record<ParticleMode, number> = {
  embers: 60, rain: 110, snow: 70, dust: 45, bubbles: 40, sparks: 55,
  ash: 55, petals: 34, pollen: 42,
  fireflies: 34, confetti: 60, leaves: 30, stars: 55,
};

export const KineticParticles = forwardRef<ParticleHandle, {
  mode: ParticleMode;
  /** 0..1 — the section's emotional intensity drives density + speed. */
  intensity: number;
  /** Song palette for tinting (dust/bubbles/sparks); warm modes self-color. */
  palette?: string[];
  /** Density multiplier (phrase mode runs lighter). */
  scale?: number;
  /** Phone/low-power profile: dpr-1 canvas, ~0.6 density, single-arc dots. */
  lite?: boolean;
  /** Skip drawing entirely (e.g. while a full-screen veil hides the weather). */
  paused?: boolean;
  /** Director knob: extra population multiplier on top of intensity/scale (default 1).
   *  Driven through a ref so dragging the slider doesn't rebuild the rAF loop. */
  density?: number;
}>(function KineticParticles({ mode, intensity, palette, scale = 1, lite = false, paused = false, density = 1 }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const parts = useRef<P[]>([]);
  const wind = useRef(0);
  const pull = useRef(0);
  const frozen = useRef(false);
  const emo = useRef(intensity);
  emo.current = intensity;
  const densRef = useRef(density);
  densRef.current = density;
  const modeRef = useRef(mode);
  const palRef = useRef(palette);
  palRef.current = palette;

  useImperativeHandle(ref, () => ({
    burst(x, y, n = 40) {
      const arr = parts.current;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const sp = 90 + Math.random() * 260;
        arr.push(spawn(modeRef.current, palRef.current, x, y, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9 + Math.random() * 0.8, extra: true,
        }));
      }
      if (arr.length > 900) arr.splice(0, arr.length - 900);
    },
    trail(x, y, vx, vy) {
      const arr = parts.current;
      for (let i = 0; i < 2; i++) {
        arr.push(spawn(modeRef.current, palRef.current, x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14, {
          vx: vx * 14 + (Math.random() - 0.5) * 60, vy: vy * 14 + (Math.random() - 0.5) * 60,
          life: 0.5 + Math.random() * 0.5, extra: true,
        }));
      }
      if (arr.length > 900) arr.splice(0, arr.length - 900);
    },
    gust(dir = 1) { wind.current = dir * 900; },
    quake() {
      for (const p of parts.current) { p.vx += (Math.random() - 0.5) * 500; p.vy += (Math.random() - 0.5) * 500; }
    },
    glint(n = 10) {
      const arr = parts.current;
      for (let i = 0; i < n && arr.length; i++) {
        const p = arr[(Math.random() * arr.length) | 0];
        p.glint = 1;
      }
    },
    implode(strength) { pull.current = Math.max(pull.current, Math.min(1, strength)); },
    freeze(on) { frozen.current = on; },
  }), []);

  useEffect(() => {
    modeRef.current = mode;
    // Mode switch: let the old weather die out naturally (extra=false pool
    // respawns in the new mode as particles expire).
    for (const p of parts.current) p.maxLife = Math.min(p.maxLife, p.life + 1.5);
  }, [mode]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      // Phones: pin DPR to 1. A 3× phone at the old cap of 2 filled+cleared 4×
      // the pixels every frame — the single biggest canvas cost on mobile.
      dpr = lite ? 1 : Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0, last = performance.now(), lastBeat = 0, beatKick = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      // Hidden under a full-screen veil (fog moment): skip the redraw. The
      // canvas keeps its last frame — invisible anyway — and resumes cleanly.
      if (pausedRef.current) return;
      const m = modeRef.current;
      // target population follows the emotional intensity (thinned on phones)
      const target = Math.round(DENSITY[m] * scale * densRef.current * (lite ? 0.6 : 1) * (0.45 + emo.current * 0.85) * Math.min(1, w / 900));
      const arr = parts.current;
      const ambient = arr.reduce((n, p) => n + (p.extra ? 0 : 1), 0);
      for (let i = ambient; i < target; i++) arr.push(spawn(m, palRef.current, Math.random() * w, edgeY(m, h), { fresh: true }));
      // beat pulse — particles glow/kick on the live beat
      if (beatClock.ready && beatClock.lastBeatAt !== lastBeat) { lastBeat = beatClock.lastBeatAt; beatKick = 1; }
      beatKick *= Math.pow(0.02, dt); // fast decay
      wind.current *= Math.pow(0.25, dt);

      ctx.clearRect(0, 0, w, h);
      pull.current *= Math.pow(0.5, dt);
      const speed = (frozen.current ? 0.06 : 1) * (0.75 + emo.current * 0.7 + beatKick * 0.25);
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life += dt * (frozen.current ? 0.15 : 1);
        if (p.life > p.maxLife || p.y < -30 || p.y > h + 30 || p.x < -40 || p.x > w + 40) {
          if (p.extra || ambient > target) { arr.splice(i, 1); continue; }
          Object.assign(p, spawn(m, palRef.current, Math.random() * w, edgeY(m, h), { fresh: true }));
        }
        p.wobble += dt * (1.3 + (p.r % 1));
        const sway = Math.sin(p.wobble) * (m === "petals" || m === "leaves" ? 36 : m === "confetti" ? 32 : m === "snow" ? 28 : m === "bubbles" ? 22 : m === "ash" ? 20 : m === "fireflies" ? 18 : m === "pollen" ? 16 : 10);
        // riser implosion: everything spirals toward the heart of the stage
        if (pull.current > 0.02) {
          const dx = w / 2 - p.x, dy = h / 2 - p.y;
          const d = Math.max(60, Math.hypot(dx, dy));
          p.vx += (dx / d) * pull.current * 900 * dt;
          p.vy += (dy / d) * pull.current * 900 * dt;
        }
        p.x += (p.vx * speed + sway + wind.current) * dt;
        p.y += p.vy * speed * dt;
        // extras decelerate back toward ambient motion
        if (p.extra) { p.vx *= Math.pow(0.3, dt); p.vy = p.vy * Math.pow(0.3, dt) + baseVy(m) * (1 - Math.pow(0.3, dt)); }
        if (p.glint) p.glint = Math.max(0, p.glint - dt * 5);
        const fade = Math.min(1, Math.min(p.life * 3, (p.maxLife - p.life) * 2));
        const alpha = p.a * fade * (0.75 + beatKick * 0.5) * (1 + (p.glint ?? 0) * 1.6);
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = p.hue;
        if (m === "rain" || (m === "sparks" && Math.abs(p.vx) + Math.abs(p.vy) > 120)) {
          // streak: draw along the velocity vector
          ctx.strokeStyle = p.hue;
          ctx.lineWidth = p.r * (m === "rain" ? 0.6 : 0.9);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
        } else if (m === "bubbles") {
          ctx.strokeStyle = p.hue;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
          ctx.globalAlpha = Math.min(1, alpha * 0.35);
          ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.3, 0, 7); ctx.fill();
        } else if (lite) {
          // Phones: a single slightly-larger core — half the draw calls, and no
          // per-particle halo fill (the biggest per-frame canvas cost).
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.35, 0, 7); ctx.fill();
        } else {
          // soft dot: halo + core (cheaper than shadowBlur)
          ctx.globalAlpha = Math.min(1, alpha * 0.35);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, 7); ctx.fill();
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [scale, lite]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[2]"
      aria-hidden
    />
  );
});

function baseVy(m: ParticleMode): number {
  switch (m) {
    case "embers": return -55;
    case "rain": return 620;
    case "snow": return 55;
    case "dust": return -14;
    case "bubbles": return -70;
    case "sparks": return 0;
    case "ash": return 40;
    case "petals": return 34;
    case "pollen": return -6;
    case "fireflies": return -4;
    case "confetti": return 55;
    case "leaves": return 32;
    case "stars": return -2;
  }
}

function edgeY(m: ParticleMode, h: number): number {
  // fresh ambient particles enter from the edge they travel away from
  if (m === "rain" || m === "snow" || m === "ash" || m === "petals" || m === "confetti" || m === "leaves") return -20 + Math.random() * -60;
  if (m === "embers" || m === "bubbles") return h + 10 + Math.random() * 40;
  return Math.random() * h; // fireflies / stars / dust / pollen / sparks: anywhere
}

function spawn(m: ParticleMode, palette: string[] | undefined, x: number, y: number,
  o: { vx?: number; vy?: number; life?: number; extra?: boolean; fresh?: boolean } = {}): P {
  const pal = palette?.length ? palette : ["#8899aa"];
  const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
  const base: P = {
    x, y: o.fresh ? y : y, vx: o.vx ?? 0, vy: o.vy ?? baseVy(m),
    r: 1.5, a: 0.5, hue: pick(pal), life: 0, maxLife: o.life ?? (4 + Math.random() * 6),
    wobble: Math.random() * 7, extra: o.extra,
  };
  switch (m) {
    case "embers":
      return { ...base, hue: pick(WARM), r: 1 + Math.random() * 2.2, a: 0.5 + Math.random() * 0.5, vx: o.vx ?? (Math.random() - 0.5) * 30, vy: o.vy ?? -(35 + Math.random() * 80) };
    case "rain":
      return { ...base, hue: "rgba(170,200,235,0.9)", r: 1.6 + Math.random() * 1.6, a: 0.25 + Math.random() * 0.3, vx: o.vx ?? -30 - Math.random() * 40, vy: o.vy ?? (480 + Math.random() * 320), maxLife: o.life ?? 9 };
    case "snow":
      return { ...base, hue: "rgba(240,246,255,0.95)", r: 1.2 + Math.random() * 2.6, a: 0.4 + Math.random() * 0.45, vx: o.vx ?? (Math.random() - 0.5) * 20, vy: o.vy ?? (30 + Math.random() * 55) };
    case "dust":
      return { ...base, r: 0.8 + Math.random() * 1.6, a: 0.18 + Math.random() * 0.25, vx: o.vx ?? (Math.random() - 0.3) * 16, vy: o.vy ?? -(8 + Math.random() * 16) };
    case "bubbles":
      return { ...base, r: 2 + Math.random() * 5, a: 0.3 + Math.random() * 0.35, vx: o.vx ?? (Math.random() - 0.5) * 24, vy: o.vy ?? -(45 + Math.random() * 60) };
    case "sparks":
      return { ...base, r: 0.9 + Math.random() * 1.4, a: 0.4 + Math.random() * 0.5, vx: o.vx ?? (Math.random() - 0.5) * 160, vy: o.vy ?? (Math.random() - 0.5) * 90, maxLife: o.life ?? (0.8 + Math.random() * 2.2) };
    case "ash":
      // spent, cooling flakes: grey, slow, drifting DOWN (occasionally a warm one)
      return { ...base, hue: pick(ASH), r: 1 + Math.random() * 2.4, a: 0.3 + Math.random() * 0.4, vx: o.vx ?? (Math.random() - 0.5) * 24, vy: o.vy ?? (28 + Math.random() * 46), maxLife: o.life ?? (6 + Math.random() * 6) };
    case "petals":
      // rose petals: big, soft, tumbling down with wide sway
      return { ...base, hue: pick(PETAL), r: 3 + Math.random() * 3.5, a: 0.5 + Math.random() * 0.4, vx: o.vx ?? (Math.random() - 0.5) * 30, vy: o.vy ?? (24 + Math.random() * 40) };
    case "pollen":
      // golden motes suspended in warm air — near-still, faint upward drift
      return { ...base, hue: pick(GOLD), r: 0.8 + Math.random() * 1.6, a: 0.3 + Math.random() * 0.3, vx: o.vx ?? (Math.random() - 0.5) * 14, vy: o.vy ?? -(4 + Math.random() * 12) };
    case "fireflies":
      // glowing motes that blink in and out — short life = twinkle, wide wander
      return { ...base, hue: pick(FIREFLY), r: 1 + Math.random() * 1.8, a: 0.45 + Math.random() * 0.45, vx: o.vx ?? (Math.random() - 0.5) * 22, vy: o.vy ?? -(2 + Math.random() * 10), maxLife: o.life ?? (1.6 + Math.random() * 2.6) };
    case "confetti":
      // small colorful bits tumbling down, party energy
      return { ...base, hue: pick(CONFETTI), r: 1.8 + Math.random() * 2.4, a: 0.55 + Math.random() * 0.4, vx: o.vx ?? (Math.random() - 0.5) * 40, vy: o.vy ?? (40 + Math.random() * 70) };
    case "leaves":
      // autumn leaves: big, soft, tumbling down with wide sway
      return { ...base, hue: pick(LEAF), r: 2.6 + Math.random() * 3, a: 0.5 + Math.random() * 0.4, vx: o.vx ?? (Math.random() - 0.5) * 34, vy: o.vy ?? (20 + Math.random() * 38) };
    case "stars":
      // a night sky that twinkles — near-still points, short life to blink
      return { ...base, hue: pick(STAR), r: 0.8 + Math.random() * 1.7, a: 0.5 + Math.random() * 0.45, vx: o.vx ?? (Math.random() - 0.5) * 8, vy: o.vy ?? -(1 + Math.random() * 6), maxLife: o.life ?? (1.4 + Math.random() * 2.4) };
  }
}

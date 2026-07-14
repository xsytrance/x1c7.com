"use client";

// The living backdrop's mount point — a WebGL2 canvas breathing BEHIND the
// generated song art (art sits at -z-10 with 0.6–0.85 opacity, so the field
// glows through it; when a song has no art, the field IS the sky).
//
// Owns its own rAF: KineticStage's master tick writes the feature bus first
// (same frame), this loop reads it, ticks param morphs + the modulators, and
// renders scene → trails → post. Degrades to nothing: no WebGL2, a lost
// context, or a shader failure simply leaves the DOM show exactly as it was.

import { useEffect, useRef } from "react";
import { initGL } from "@/lib/engine/gl";
import { BackdropRenderer, fnv1a } from "@/lib/engine/backdrop";
import { featureBus } from "@/lib/engine/features";
import { P } from "@/lib/engine/params";
import { ensureModEngine } from "@/lib/engine/lfo";
import { stemMixStore } from "@/lib/stemMix";

export function KineticBackdrop({ seed, palette, sectionEmotion = null, sectionIntensity = 0.35 }: {
  /** Stable per-song seed (track id) — picks the AUTO scene + noise offsets. */
  seed: string;
  /** The song's palette hexes (planet analysis or track color). */
  palette: string[];
  /** The current section's emotion — keys the CHORUS-MEMORY look (below). */
  sectionEmotion?: string | null;
  /** The current section's emotional intensity 0..1. */
  sectionIntensity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BackdropRenderer | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = initGL(canvas);
    if (!gl) return; // no WebGL2 — the DOM show carries on untouched
    let renderer: BackdropRenderer;
    try {
      renderer = new BackdropRenderer(gl, canvas);
    } catch {
      return; // a shader that won't compile must never take down the stage
    }
    rendererRef.current = renderer;

    // Console handle (PRISM's window.PRISM pattern): poke params and read the
    // live feature bus from devtools — KINETICA.P.set("backdrop.trails", 0.9).
    (window as unknown as Record<string, unknown>).KINETICA = { P, featureBus, stemMixStore };

    const mod = ensureModEngine();
    // First run ever: one tasteful default routing so the machine visibly
    // breathes — a 4-bar sine drifting the backdrop hue. A preset overwrites it.
    if (P.getStr("lfo1.target") === "NONE") {
      P.set("lfo1.target", "backdrop.hueShift");
      P.set("lfo1.rate", "4 BARS");
      P.set("lfo1.depth", 0.22);
      P.set("lfo1.enabled", true);
    }

    // The canvas renders at CSS-pixel size (dpr 1): it's soft atmosphere at
    // renderScale 0.5 anyway — fill rate stays phone-friendly.
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width));
      const h = Math.max(2, Math.round(r.height));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    let dead = false;
    const onLost = (e: Event) => { e.preventDefault(); dead = true; };
    canvas.addEventListener("webglcontextlost", onLost);

    let raf = 0;
    let lastOpacity = "";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (dead || document.hidden) return;
      const on = P.getBool("backdrop.enabled");
      const op = on ? P.get("backdrop.opacity").toFixed(3) : "0";
      if (op !== lastOpacity) { lastOpacity = op; canvas.style.opacity = op; }
      if (!on) return;
      P.tickMorphs(performance.now() / 1000);
      mod.update(featureBus.F);
      try {
        renderer.render(featureBus.F);
      } catch {
        dead = true; // fail dark, never fail loud
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // New song (or a live palette update from the studio): re-seed the field.
  useEffect(() => {
    rendererRef.current?.setSong(palette, seed);
  }, [seed, palette]);

  // ── CHORUS MEMORY ── every section emotion owns a backdrop look, derived
  // deterministically from hash(song, emotion): its own hue lean, flow, trail
  // length, bloom. When the chorus comes back, ITS look comes back with it —
  // PRISM's sticky autopilot idea, but computed from the analysis instead of
  // guessed live. The look morphs in over one bar of the real grid, so the
  // transition itself is musical.
  useEffect(() => {
    if (!sectionEmotion) return;
    const h = fnv1a(`${seed}::${sectionEmotion.toLowerCase()}`);
    const u = (shift: number, mod: number) => ((h >>> shift) % mod) / (mod - 1); // 0..1, stable
    const bpm = featureBus.F.bpm;
    const barSec = bpm > 0 ? (4 * 60) / bpm : 2.4;
    P.morphTo({
      "backdrop.hueShift": (u(0, 41) - 0.5) * 0.44,
      "backdrop.flow": (0.7 + u(3, 17) * 0.9) * (0.75 + sectionIntensity * 0.5),
      "backdrop.trails": 0.35 + u(6, 13) * 0.45,
      "backdrop.bloom": 0.22 + u(9, 11) * 0.5 + sectionIntensity * 0.25,
      "backdrop.intensity": 0.8 + sectionIntensity * 0.55,
    }, barSec, performance.now() / 1000);
  }, [seed, sectionEmotion, sectionIntensity]);

  return (
    <canvas
      ref={ref}
      // canvas is a REPLACED element: inset-0 alone doesn't stretch it the way
      // it does the art div — it keeps its intrinsic size. w/h-full make the
      // fixed box actually fill the viewport.
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full"
      style={{ opacity: 0.6, transition: "opacity 800ms ease" }}
      aria-hidden
    />
  );
}

"use client";

// ── PERF HARNESS (diagnostics only, unlinked) ───────────────────────────────
// Drives the REAL full show with a synthetic song + a deterministic clock so
// scripts/perf-probe.mjs can measure frame times under mobile CPU throttling
// without needing audio, a real planet, or clicking through /music.
//
//   /dev/perf?scene=fog     → clock parked inside a fog wipe moment
//   /dev/perf?scene=normal  → clock in a plain words+weather stretch
//   &lite=1 | &lite=0       → force the perf profile (else auto-detect)
//   &mode=dynamic|phrase|focus  (default dynamic — the heaviest)
//   &weather=rain|snow|embers|… (default rain — the densest)

import { useEffect, useMemo, useRef, useState } from "react";
import { KineticStage } from "@/components/KineticStage";
import { KineticLooksPanel } from "@/components/KineticLooksPanel";
import { KineticParamPanel } from "@/components/KineticParamPanel";
import type { ParticleMode } from "@/components/KineticParticles";
import type { Track } from "@/lib/engineHost";
import { supabase, type TrackRow } from "@/lib/supabase";
import { trackFromRow } from "@/lib/useTracks";

// A word every ~0.5s from t=1..40 — uniform spacing (no 7s gap) so the only
// wipe moment is the explicit fog one below, not a synthesized instrumental gap.
const VOCAB = "rain falls over the neon city tonight and every light bleeds gold while the water rises through the streets we drown in sound".split(" ");
const WORDS = Array.from({ length: 78 }, (_, i) => ({ t: 1 + i * 0.5, w: VOCAB[i % VOCAB.length] }));

const TRACK: Track = {
  id: "perf-synthetic",
  title: "Perf Harness",
  artist: "diagnostics",
  duration: "0:40",
  durationSeconds: 40,
  art: "",
  genre: "Ambient",
  mood: "rain",
  color: "#43f7ff",
  audioUrl: "",
  lyrics: "",
  lyricsSynced: { words: WORDS },
  planet: {
    generatedAt: null,
    analysis: {
      summary: "A synthetic song for measuring the renderer.",
      overallMood: "rain",
      themes: ["rain", "city", "water", "light"],
      palette: ["#43f7ff", "#7c3cff", "#ff2440", "#8dff4a"],
      sections: [
        { name: "intro", emotion: "calm", intensity: 0.3, colorHint: "#43f7ff", start: 0 },
        { name: "build", emotion: "longing", intensity: 0.55, colorHint: "#7c3cff", start: 12 },
        { name: "drop", emotion: "intense", intensity: 0.82, colorHint: "#ff2440", start: 22 },
        { name: "outro", emotion: "dreamy", intensity: 0.4, colorHint: "#8dff4a", start: 34 },
      ],
      keywords: [
        { word: "rain", emotion: "longing", imageryPrompt: "" },
        { word: "neon", emotion: "intense", imageryPrompt: "" },
        { word: "gold", emotion: "euphoric", imageryPrompt: "" },
        { word: "drown", emotion: "despair", imageryPrompt: "" },
      ],
    },
    assets: {
      // Local backdrop art so the harness includes the Ken-Burns image layer
      // the real show always carries (passes through planetUrl untouched).
      sections: {
        calm: "/art/art-01.jpg",
        longing: "/art/art-02.jpg",
        intense: "/art/art-03.jpg",
        dreamy: "/art/art-04.jpg",
      },
    },
    interactions: {
      tapEffect: "dissolve",
      // The fog wipe moment we park inside for the "fog" scene.
      moments: [{ t: 6, end: 20, type: "wipe", layer: "fog", prompt: "wipe the fog away" }],
    },
  },
};

export default function PerfHarness() {
  const tRef = useRef(0);
  const params = useMemo(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const scene = params.get("scene") || "normal";
  const mode = (params.get("mode") || "dynamic") as "dynamic" | "phrase" | "focus";
  const weather = (params.get("weather") || "rain") as ParticleMode;
  // &stems=1 → attach a real stems.json so the per-frame stem-sense var writes
  // (--kick/--bass/--voice/--choir) fire. Without it the harness measures the
  // renderer as if every planet were stem-less — which hid the biggest mobile
  // cost (a root custom-property write per frame → tree-wide style recalc).
  // &melody=1 → attach the same planet's melody.json (per-word sung pitch →
  // word color). Indices won't match the synthetic lyric semantically — this
  // is for exercising the pitch-color path, not judging the mapping.
  const synthTrack = useMemo<Track>(() => {
    const assets: Record<string, string> = {};
    if (params.get("stems") === "1") assets.stems = "/planets/i-won-t-be-your-fire/stems.json";
    if (params.get("melody") === "1") assets.melody = "/planets/i-won-t-be-your-fire/melody.json";
    if (!Object.keys(assets).length) return TRACK;
    return { ...TRACK, planet: { ...TRACK.planet!, assets: { ...TRACK.planet!.assets, ...assets } } };
  }, [params]);

  // &planet=<slug> → measure a REAL planet's config (its palette, keywords,
  // sections, backdrop art, stems, moments) instead of the synthetic song.
  const planetSlug = params.get("planet");
  const [realTrack, setRealTrack] = useState<Track | null>(null);
  useEffect(() => {
    if (!planetSlug) return;
    let on = true;
    supabase.from("tracks").select("*").eq("id", planetSlug).limit(1)
      .then(({ data }) => { if (on && data && data[0]) setRealTrack(trackFromRow(data[0] as TrackRow)); });
    return () => { on = false; };
  }, [planetSlug]);
  const track = planetSlug ? realTrack : synthTrack;

  // Force the perf profile before the stage detects it.
  useEffect(() => {
    const lite = params.get("lite");
    try {
      if (lite === "1") localStorage.setItem("x1c7-perf", "lite");
      else if (lite === "0") localStorage.setItem("x1c7-perf", "full");
    } catch {
      /* ignore */
    }
  }, [params]);

  // Deterministic clock: sawtooth inside a 9s window so the show renders
  // continuously. For a real planet, &at=<t> parks the window at that song-time
  // (default 40 — a sung stretch); else the synthetic scene windows.
  const at = params.get("at");
  useEffect(() => {
    let lo: number, hi: number;
    if (planetSlug) { lo = at ? Number(at) : 40; hi = lo + 9; }
    else { [lo, hi] = scene === "fog" ? [8, 18] : [24, 33]; }
    const span = hi - lo;
    let raf = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      tRef.current = lo + (((now - start) / 1000) % span);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scene, planetSlug, at]);

  return (
    <div className="fixed inset-0 bg-black">
      {track && <KineticStage track={track} pass={Number(params.get("pass")) || 4} mode={mode} forceParticle={weather} clock={() => tRef.current} />}
      {/* &looks=1 → mount the looks picker (exercises fire/capture headlessly) */}
      {params.get("looks") === "1" && <KineticLooksPanel className="absolute bottom-6 right-4 z-20" />}
      {/* &panel=1 → mount the self-building param panel (UI overhaul phase 1) */}
      {params.get("panel") === "1" && (
        <KineticParamPanel groups={["BACKDROP", "LFO 1", "FOLLOW 1"]} className="absolute right-3 top-3 z-20 max-h-[90vh] w-80 overflow-y-auto" />
      )}
    </div>
  );
}

"use client";

// /vr — the lyric show as a world. Phase 0 spike: pick a planet, press play,
// and stand inside it. On a Quest (or any WebXR browser) the ENTER VR button
// goes immersive; everywhere else it's a mouse-orbit 3D preview of the same
// scene. Three.js loads ONLY on this route — the rest of the site never
// pays for it.

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { canPerform } from "@/components/KineticStage";

// Everything Three/WebXR stays behind ssr:false — the server never touches it
// and the rest of the site never downloads it.
const VRStage = dynamic(() => import("@/components/vr/VRStage").then((m) => m.VRStage), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center font-mono text-xs uppercase tracking-[0.4em] text-white/40">
      warming the universe…
    </div>
  ),
});
const EnterVR = dynamic(() => import("@/components/vr/VRStage").then((m) => m.EnterVR), { ssr: false });

export default function VRPage() {
  // useSearchParams needs a Suspense boundary to keep the route statically prerenderable.
  return (
    <Suspense fallback={null}>
      <VRPageInner />
    </Suspense>
  );
}

function VRPageInner() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack, togglePlay } = useMusicPlayer();
  const planets = useMemo(() => tracks.filter(canPerform), [tracks]);
  const linked = useSearchParams().get("track");
  const [chosenId, setChosenId] = useState("");
  const selectedId =
    chosenId ||
    (linked && planets.some((t) => t.id === linked) ? linked : planets[0]?.id ?? "");
  const selected = planets.find((t) => t.id === selectedId);
  const live = currentTrack && canPerform(currentTrack) ? currentTrack : null;

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#05030b]">
      {live && <VRStage track={live} />}

      {/* control bar */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="font-display text-sm font-black uppercase tracking-[0.3em] text-white">VR</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/40">phase 0 · webxr spike</span>
        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setChosenId(e.target.value)}
            className="max-w-[44vw] rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white outline-none"
          >
            {planets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          {selected && (!live || live.id !== selected.id) && (
            <button
              onClick={() => playTrack(selected, tracks)}
              className="rounded-full px-4 py-1.5 font-mono text-xs font-black uppercase tracking-wider text-void"
              style={{ background: "var(--theme-primary)" }}
            >
              ▶ Launch
            </button>
          )}
          {live && (
            <button onClick={togglePlay} className="rounded-full border border-white/20 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-white/70">
              {isPlaying ? "Pause" : "Play"}
            </button>
          )}
          <Link href="/galaxy" className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">
            🌌 Galaxy
          </Link>
        </div>
      </header>

      {/* Enter VR — WebXR immersive session (Quest browser & friends) */}
      {live && (
        <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2">
          <EnterVR />
        </div>
      )}

      {!live && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-white/40">pick a planet and press Launch</p>
        </div>
      )}
    </main>
  );
}

"use client";

// THE LENS — x-ray listening. While armed, hold anywhere on the stage and the
// mix collapses to the layer under your finger: the lyrics are the voice, the
// floor is the rhythm section, the sky is the choir, everywhere else is the
// melodic bed. Release and the full picture snaps back. Zero UI to learn —
// the stage itself is the mixer.

import { useEffect, useRef, useState } from "react";
import { useMusicPlayer } from "./MusicPlayerContext";
import { useStemMix, stemMixStore } from "@/lib/stemMix";
import type { StemName } from "@/lib/stemSense";

interface Zone { id: string; label: string; stems: StemName[] }

/** What lives under a point on the stage. Words are hit-tested for real
 * (the lyric layer is the voice); the rest is honest geography. */
function zoneAt(x: number, y: number, h: number, available: StemName[], hasWordAt: boolean): Zone {
  const pick = (ids: StemName[]) => ids.filter((s) => available.includes(s));
  const yf = y / Math.max(1, h);
  let zone: Zone;
  if (hasWordAt) zone = { id: "voice", label: "the voice", stems: pick(["lead"]) };
  else if (yf > 0.72) zone = { id: "floor", label: "the floor", stems: pick(["drums", "perc", "bass"]) };
  else if (yf < 0.22 && available.includes("back")) zone = { id: "choir", label: "the choir", stems: pick(["back"]) };
  else zone = { id: "bed", label: "the bed", stems: pick(["synth", "guitar", "keys", "other"]) };
  // A zone this song doesn't have falls through to everything — never silence.
  if (zone.stems.length === 0) zone = { id: "all", label: "everything", stems: available };
  return zone;
}

export function StemLens({ onDisarm }: { onDisarm: () => void }) {
  const { stemBus } = useMusicPlayer();
  const mix = useStemMix();
  const [zone, setZone] = useState<Zone | null>(null); // non-null while holding
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const wasActive = useRef(false);
  const zoneId = useRef<string | null>(null);
  const raf = useRef(0);

  // Never leave a stuck solo behind (unmount mid-hold, track change).
  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    if (zoneId.current !== null) {
      stemMixStore.setSolo(null);
      zoneId.current = null;
    }
  }, []);

  const paint = (x: number, y: number) => {
    const ring = ringRef.current, dim = dimRef.current;
    if (ring) ring.style.transform = `translate(${x - 90}px, ${y - 90}px)`;
    if (dim) dim.style.background =
      `radial-gradient(circle 200px at ${x}px ${y}px, transparent 0 110px, rgba(2,1,6,0.5) 210px)`;
  };

  const update = (e: React.PointerEvent) => {
    const x = e.clientX, y = e.clientY;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      paint(x, y);
      const word = document.elementsFromPoint(x, y).some((el) => (el as HTMLElement).closest?.(".kinetic-word"));
      const z = zoneAt(x, y, window.innerHeight, stemMixStore.snapshot().available, word);
      if (z.id !== zoneId.current) {
        zoneId.current = z.id;
        stemMixStore.setSolo(z.stems);
        setZone(z);
      }
    });
  };

  const start = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wasActive.current = stemMixStore.snapshot().active;
    stemBus.engage();
    update(e);
  };

  const end = () => {
    cancelAnimationFrame(raf.current);
    zoneId.current = null;
    setZone(null);
    stemMixStore.setSolo(null);
    // Held from the full mix → the full mix comes back, not the stem bus.
    if (!wasActive.current) stemBus.disengage();
  };

  return (
    <div
      className="absolute inset-0 z-[50] touch-none select-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={start}
      onPointerMove={(e) => { if (zone) update(e); }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* spotlight dark-out + the lens ring — painted imperatively, no re-render */}
      <div ref={dimRef} className="pointer-events-none absolute inset-0 transition-opacity" style={{ opacity: zone ? 1 : 0 }} aria-hidden />
      <div ref={ringRef} className="pointer-events-none absolute left-0 top-0 h-[180px] w-[180px] rounded-full transition-opacity" aria-hidden
        style={{
          opacity: zone ? 1 : 0,
          border: "1.5px solid color-mix(in srgb, var(--theme-primary) 85%, white)",
          boxShadow: "0 0 24px color-mix(in srgb, var(--theme-primary) 55%, transparent), inset 0 0 30px color-mix(in srgb, var(--theme-primary) 22%, transparent)",
          backdropFilter: "brightness(1.18) saturate(1.15)",
        }}>
        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-[0.3em]"
          style={{ color: "var(--theme-primary)", textShadow: "0 0 12px color-mix(in srgb, var(--theme-primary) 70%, transparent)" }}>
          {zone?.label}
        </span>
      </div>

      {/* hint + exit — the only chrome the Lens has */}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 py-2 backdrop-blur-md">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/65">
            {mix.status === "loading" ? "🔍 separating the song…" : zone ? `🔍 hearing ${zone.label}` : "🔍 hold anywhere — hear what lives there"}
          </span>
          <button onClick={onDisarm} onPointerDown={(e) => e.stopPropagation()}
            className="rounded-full border border-white/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70 transition hover:text-white">
            ✕ lens
          </button>
        </div>
      </div>
    </div>
  );
}

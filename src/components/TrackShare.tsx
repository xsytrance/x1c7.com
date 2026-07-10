"use client";
// The share page body — one case, center stage. Preview drops at the hottest
// bar; PLAY runs the real player (and the cinematic full show when the track
// can perform). If the ultimate analyzer has published a profile.json for
// this track, its SONIC DOSSIER renders below — no code change needed there.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { TrackRow } from "@/lib/supabase";
import { trackFromRow } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { CinematicLyrics } from "@/components/CinematicLyrics";
import { canPerform } from "@/components/KineticStage";
import { classifyGenre, cardUrl, fmtTime } from "@/lib/collection";
import { usePreview, stemsFor } from "@/lib/usePreview";
import type { StemData } from "@/lib/stemSense";
import ShareButton from "@/components/ShareButton";
import SonicDossier from "@/components/SonicDossier";
import Booklet, { type BookletHandle } from "@/components/Booklet";

export default function TrackShare({ row }: { row: TrackRow }) {
  const track = useMemo(() => trackFromRow(row), [row]);
  const { playTrack, pause } = useMusicPlayer();
  const preview = usePreview(pause);
  const [meta, setMeta] = useState<StemData | null>(null);
  const pal = classifyGenre(track.genre);
  const booklet = useRef<BookletHandle>(null);
  const [hasBooklet, setHasBooklet] = useState(false);

  useEffect(() => { void stemsFor(track).then(setMeta); }, [track]);

  const previewing = preview.state.id === track.id;

  return (
    <main className="relative min-h-screen overflow-hidden pb-32">
      <div className="starfield" aria-hidden />
      <div className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: `radial-gradient(80% 60% at 50% 10%, ${pal.base[0]}bb, transparent 75%), radial-gradient(70% 50% at 50% 100%, ${pal.accent}14, transparent 70%)` }} />

      <div className="relative z-10 mx-auto max-w-xl px-4 pt-10 text-center sm:pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">agenor presents</p>

        <motion.div initial={{ opacity: 0, y: 24, rotateY: 18 }} animate={{ opacity: 1, y: 0, rotateY: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }} className="relative mt-6" style={{ transformPerspective: 900 }}>
          <motion.div whileHover={{ scale: 1.015, rotateY: -3 }} whileTap={{ scale: 0.985 }}
            className="relative mx-auto w-full max-w-[480px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardUrl(track.id)} alt={`${track.title} collector cover`}
              className="aspect-square w-full cursor-pointer rounded-lg object-cover"
              style={{ boxShadow: `0 30px 90px -24px ${pal.accent}66` }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = track.cover || track.art; }}
              onClick={() => booklet.current?.open()}
              title="open the case"
            />
            {/* the insert's calling card — floats once the booklet exists */}
            {hasBooklet ? (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: [0, -5, 0] }}
                transition={{ opacity: { duration: 0.5 }, y: { repeat: Infinity, duration: 2.4, ease: "easeInOut" } }}
                className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-max rounded-full bg-black/65 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.22em] text-white/90 backdrop-blur-sm">
                📖 TAP TO OPEN THE CASE
              </motion.span>
            ) : null}
          </motion.div>
        </motion.div>

        <h1 className="mt-7 font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">{track.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 font-mono text-xs text-white/60">
          <span className="rounded-sm px-2 py-0.5 text-black" style={{ background: pal.accent }}>{pal.label}</span>
          {meta?.bpm ? <span>{Math.round(meta.bpm)} BPM</span> : null}
          {meta?.duration ? <span>{fmtTime(meta.duration)}</span> : null}
          {track.mood ? <span>{track.mood}</span> : null}
          {canPerform(track) ? <span>🪐 FULL SHOW</span> : null}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {track.audioUrl ? (
            <>
              <button
                onClick={() => (previewing ? preview.stop() : void preview.start(track))}
                className="rounded-sm border px-5 py-3 font-mono text-sm tracking-[0.16em] transition"
                style={previewing ? { borderColor: pal.accent, color: pal.accent } : { borderColor: "#ffffff33", color: "#ffffffb0" }}
              >
                {previewing ? "■ STOP PREVIEW" : "⚡ HEAR THE DROP"}
              </button>
              <button
                onClick={() => { preview.stop(false); playTrack(track, [track]); }}
                className="rounded-sm px-6 py-3 font-mono text-sm tracking-[0.16em] text-black transition hover:brightness-110"
                style={{ background: pal.accent }}
              >
                ▶ PLAY {canPerform(track) ? "THE SHOW" : "FULL TRACK"}
              </button>
            </>
          ) : (
            <span className="rounded-sm border border-dashed border-white/20 px-5 py-3 font-mono text-sm tracking-[0.16em] text-white/40">COMING SOON</span>
          )}
          {track.sunoUrl ? (
            <a href={track.sunoUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-sm border border-white/20 px-5 py-3 font-mono text-sm tracking-[0.16em] text-white/70 transition hover:border-white/60 hover:text-white">
              SUNO ↗
            </a>
          ) : null}
          <ShareButton id={track.id} sizing="px-5 py-3 text-sm" />
        </div>

        {previewing ? (
          <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-white/40">
            PREVIEWING THE DROP · {fmtTime(preview.state.startAt)}
          </p>
        ) : null}
        {preview.state.blocked ? (
          <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-white/40">TAP AGAIN TO ENABLE SOUND</p>
        ) : null}

        {track.planet?.analysis?.summary ? (
          <p className="mx-auto mt-8 max-w-md text-sm leading-7 text-white/55">{track.planet.analysis.summary}</p>
        ) : null}

        {/* the insert — appears only once booklet.json exists on R2; the cover art opens it too */}
        <Booklet ref={booklet} slug={track.id} accent={pal.accent} onAvailable={() => setHasBooklet(true)} />


        <SonicDossier slug={track.id} accent={pal.accent} bpm={meta?.bpm} duration={meta?.duration} />

        <div className="mt-10">
          <Link href="/music" className="font-mono text-xs tracking-[0.25em] text-white/50 underline decoration-white/20 underline-offset-4 transition hover:text-white">
            BROWSE THE FULL COLLECTION →
          </Link>
        </div>
      </div>

      {/* the takeover mounts here too — PLAY THE SHOW works right on this page */}
      <CinematicLyrics />
    </main>
  );
}

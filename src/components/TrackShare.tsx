"use client";
// The share page body — one case, center stage. Preview drops at the hottest
// bar; PLAY runs the real player (and the cinematic full show when the track
// can perform). If the ultimate analyzer has published a profile.json for
// this track, its sonic profile renders below — no code change needed there.

import { useEffect, useMemo, useState } from "react";
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

const PLANET_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

interface SonicProfile {
  identity?: { key?: string; style?: string; bpm?: number };
  summary?: string;
  energyArc?: number[];
  drops?: { t: number }[];
  [k: string]: unknown;
}

function ProfilePanel({ slug, accent }: { slug: string; accent: string }) {
  const [profile, setProfile] = useState<SonicProfile | null>(null);
  useEffect(() => {
    let dead = false;
    fetch(`${PLANET_BASE}/planets/${slug}/profile.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead && j) setProfile(j); })
      .catch(() => {});
    return () => { dead = true; };
  }, [slug]);
  if (!profile) return null;
  const arc = Array.isArray(profile.energyArc) ? profile.energyArc : null;
  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-left">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">sonic profile</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-white/70">
        {profile.identity?.key ? <span>KEY {profile.identity.key}</span> : null}
        {profile.identity?.style ? <span>{profile.identity.style}</span> : null}
      </div>
      {profile.summary ? <p className="mt-3 text-sm leading-6 text-white/60">{String(profile.summary)}</p> : null}
      {arc && arc.length > 4 ? (
        <div className="mt-4 flex h-12 items-end gap-[2px]">
          {arc.map((v, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${8 + Math.max(0, Math.min(1, v)) * 92}%`, background: accent, opacity: 0.35 + Math.max(0, Math.min(1, v)) * 0.6 }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function TrackShare({ row }: { row: TrackRow }) {
  const track = useMemo(() => trackFromRow(row), [row]);
  const { playTrack, pause } = useMusicPlayer();
  const preview = usePreview(pause);
  const [meta, setMeta] = useState<StemData | null>(null);
  const pal = classifyGenre(track.genre);

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
          transition={{ type: "spring", stiffness: 180, damping: 22 }} className="mt-6" style={{ transformPerspective: 900 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardUrl(track.id)} alt={`${track.title} collector cover`}
            className="mx-auto aspect-square w-full max-w-[480px] rounded-lg object-cover"
            style={{ boxShadow: `0 30px 90px -24px ${pal.accent}66` }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = track.cover || track.art; }}
          />
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

        <ProfilePanel slug={track.id} accent={pal.accent} />

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

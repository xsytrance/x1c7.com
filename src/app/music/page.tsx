"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SignalEngine } from "@/audio/SignalEngine";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { MagneticCard } from "@/components/MagneticCard";
import { tracks, featuredTracks, musicSources } from "@/data/tracks";
import type { Track } from "@/data/tracks";

type VizMode = "bars" | "wave" | "radial";

/* ========== TRACK CARD ========== */
function TrackCard({ track, index, isCurrent, isPlaying, onPlay }: {
  track: Track; index: number; isCurrent: boolean; isPlaying: boolean; onPlay: () => void;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const hasAudio = !!track.audioUrl;
  const hasSoundcloud = !!track.soundcloudUrl;

  return (
    <MagneticCard className={`group relative overflow-hidden rounded-[2rem] border bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-white/25 ${
      isCurrent ? "border-white/30" : "border-white/10"
    }`} strength={0.06}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay: index * 0.06, duration: 0.5 }}
      >
      {/* Album art */}
      <div className="relative aspect-square overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${track.art})` }}
        />
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 50%, ${track.color}33, transparent 70%), linear-gradient(to bottom, transparent 50%, rgba(5,3,11,0.8) 100%)` }}
        />
        {/* Playing indicator */}
        {isCurrent && isPlaying && (
          <div className="absolute right-4 top-4 flex gap-1">
            {[0, 0.15, 0.3].map((d, i) => (
              <div key={i} className="h-4 w-1 rounded-full" style={{ background: track.color, animation: `visualizerBounce 0.6s ease-in-out infinite alternate`, animationDelay: `${d}s` }} />
            ))}
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            onClick={onPlay}
            className="grid h-16 w-16 place-items-center rounded-full shadow-2xl transition hover:scale-110"
            style={{ background: track.color }}
            aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          >
            {isCurrent && isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>
        {/* Genre + Duration */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <span className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ background: `${track.color}22`, color: track.color, border: `1px solid ${track.color}33` }}>
            {track.genre}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{track.duration}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">{track.title}</h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-white/40">
          {track.artist} {track.mood ? `· ${track.mood}` : ""}
        </p>

        {/* Play controls */}
        <div className="mt-4">
          {hasAudio ? (
            <button
              onClick={onPlay}
              className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-black uppercase tracking-[0.2em] text-void transition hover:scale-[1.02]"
              style={{ background: track.color }}
            >
              {isCurrent && isPlaying ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> Pause</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg> Play</>
              )}
            </button>
          ) : hasSoundcloud ? (
            <>
              <button
                onClick={() => setShowEmbed(!showEmbed)}
                className="flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-xs font-black uppercase tracking-[0.2em] transition hover:scale-[1.02]"
                style={{ borderColor: `${track.color}44`, color: track.color }}
              >
                {showEmbed ? "Hide Player" : "Play on SoundCloud"}
              </button>
              <AnimatePresence>
                {showEmbed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="mt-3 overflow-hidden rounded-xl">
                    <iframe width="100%" height="166" scrolling="no" frameBorder="no" allow="autoplay"
                      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(track.soundcloudUrl!)}&color=${track.color.replace("#", "%23")}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false`}
                      className="rounded-xl" title={`${track.title} on SoundCloud`} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-full border border-dashed border-white/10 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">Coming soon</span>
            </div>
          )}
        </div>
      </div>
      </motion.div>
    </MagneticCard>
  );
}

/* ========== PLAYER BAR ========== */
function PlayerBar({ track, isPlaying, progress, duration, onToggle, onSeek, onNext, onPrev }: {
  track: Track; isPlaying: boolean; progress: number; duration: number;
  onToggle: () => void; onSeek: (t: number) => void; onNext: () => void; onPrev: () => void;
}) {
  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const format = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, "0")}`; };

  return (
    <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ duration: 0.4 }} className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-void/95 backdrop-blur-xl">
      {/* Progress */}
      <div className="group relative h-1.5 cursor-pointer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * duration); }}>
        <div className="absolute inset-0 bg-white/10" />
        <div className="absolute inset-y-0 left-0 transition-all" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${track.color}, ${track.color}88)` }} />
        <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full opacity-0 transition group-hover:opacity-100" style={{ left: `${pct}%`, marginLeft: -6, background: track.color }} />
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        {/* Art */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10">
          <div className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${track.art})` }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${track.color}44, ${track.color}11)` }} />
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-white">{track.title}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-wider text-white/40">{track.artist} · {format(progress)} / {format(duration)}</p>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="hidden rounded-full p-2 text-white/40 transition hover:text-white sm:block" aria-label="Previous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
          </button>
          <button onClick={onToggle} className="grid h-10 w-10 place-items-center rounded-full transition hover:scale-105" style={{ background: track.color }} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button onClick={onNext} className="hidden rounded-full p-2 text-white/40 transition hover:text-white sm:block" aria-label="Next">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ========== MAIN PAGE ========== */
export default function Page() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [vizMode, setVizMode] = useState<VizMode>("bars");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const { analyser, initAudio } = useAudioAnalyzer();

  // Create audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    initAudio(audio);

    const onTime = () => { if (audioRef.current) setProgress(audioRef.current.currentTime); };
    const onEnded = () => { setIsPlaying(false); handleNext(); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [initAudio]);

  const playTrack = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!track.audioUrl) {
      setCurrentTrack(track);
      setIsPlaying(false);
      return;
    }

    const isSame = currentTrack?.id === track.id;

    if (!isSame) {
      audio.src = track.audioUrl;
      setCurrentTrack(track);
      SignalEngine.tuneIn(track);
    }

    audio.play().catch(() => {});
    setIsPlaying(true);
  }, [currentTrack]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); SignalEngine.mute(); }
    else { audio.play().catch(() => {}); setIsPlaying(true); SignalEngine.tuneIn(currentTrack); }
  }, [currentTrack, isPlaying]);

  const handleNext = useCallback(() => {
    if (!currentTrack) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const next = tracks[(idx + 1) % tracks.length];
    if (next) playTrack(next);
  }, [currentTrack, playTrack]);

  const handlePrev = useCallback(() => {
    if (!currentTrack) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
    if (prev) playTrack(prev);
  }, [currentTrack, playTrack]);

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) { audioRef.current.currentTime = time; setProgress(time); }
  }, []);

  const heroTrack = featuredTracks[0] || tracks[0];
  const gridTracks = tracks.filter(t => t.id !== heroTrack.id);

  return (
    <main className="relative min-h-screen overflow-hidden pb-32">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />

      <div className="relative z-10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <BackToHub />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-12 pt-6 text-center sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">x1c7 transmissions</p>
        <div className="mt-5">
          <TextScramble text="Music" as="h1" className="font-display text-6xl font-black uppercase tracking-[-0.06em] glow-text sm:text-8xl lg:text-9xl" delay={200} />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-lg font-semibold leading-8 text-white/75">
          Songs born from signal, polished by human ears. Play loud.
        </p>
      </section>

      {/* ===== VISUALIZER + FEATURED ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.04] backdrop-blur">
          {/* Visualizer area */}
          {analyser && isPlaying && (
            <div className="relative h-48 sm:h-64">
              <AudioVisualizer analyser={analyser} color={currentTrack?.color || "#ff2bd6"} mode={vizMode} className="absolute inset-0" />
              {/* Mode switcher */}
              <div className="absolute bottom-3 left-3 flex gap-1">
                {(["bars", "wave", "radial"] as VizMode[]).map(m => (
                  <button key={m} onClick={() => setVizMode(m)} className={`rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${vizMode === m ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Featured track info */}
          <div className="grid items-center lg:grid-cols-[1fr_1.5fr]">
            <div className="relative aspect-square overflow-hidden">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroTrack.art})` }} />
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${heroTrack.color}33, transparent 70%)` }} />
            </div>
            <div className="p-8 sm:p-12">
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/30">Featured Transmission</p>
              <h2 className="mt-4 font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">{heroTrack.title}</h2>
              <p className="mt-3 font-mono text-sm uppercase tracking-wider text-white/40">{heroTrack.artist} · {heroTrack.duration} · {heroTrack.mood}</p>
              <p className="mt-6 max-w-md text-base leading-8 text-white/60">
                The first signal from xsy. A transmission from the edge of the creative void,
                where machines dream in sound and humans shape the noise into meaning.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {heroTrack.audioUrl ? (
                  <button onClick={() => playTrack(heroTrack)} className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105" style={{ background: heroTrack.color }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
                    {currentTrack?.id === heroTrack.id && isPlaying ? "Pause" : "Play Now"}
                  </button>
                ) : (
                  <div className="rounded-full border border-dashed border-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/40">Coming Soon</div>
                )}
                <Link href="https://soundcloud.com" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/60 transition hover:border-plasma hover:text-plasma">
                  Open SoundCloud
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <section className="relative z-10 mx-auto mt-8 max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal delay={0.1}>
          <div className="flex flex-wrap items-center justify-center gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-4 backdrop-blur">
            <div className="text-center"><p className="font-display text-2xl font-black text-white">{tracks.length}</p><p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Tracks</p></div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center"><p className="font-display text-2xl font-black text-plasma">{[...new Set(tracks.map(t => t.genre))].length}</p><p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Genres</p></div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              {musicSources.map(s => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:opacity-80" style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}33` }}>{s.name}</a>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ===== TRACK GRID ===== */}
      <section className="relative z-10 mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal><p className="mb-8 font-mono text-xs uppercase tracking-[0.4em] text-white/40">All Transmissions</p></ScrollReveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {gridTracks.map((track, i) => (
            <TrackCard key={track.id} track={track} index={i} isCurrent={currentTrack?.id === track.id} isPlaying={isPlaying} onPlay={() => playTrack(track)} />
          ))}
        </div>
      </section>

      {/* ===== PLAYER BAR ===== */}
      <AnimatePresence>
        {currentTrack && currentTrack.audioUrl && (
          <PlayerBar track={currentTrack} isPlaying={isPlaying} progress={progress} duration={currentTrack.durationSeconds} onToggle={togglePlay} onSeek={handleSeek} onNext={handleNext} onPrev={handlePrev} />
        )}
      </AnimatePresence>
    </main>
  )
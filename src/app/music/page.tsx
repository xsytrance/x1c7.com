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
import { SoundCloudEmbed } from "@/components/SoundCloudEmbed";
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
          {track.duration && track.duration !== "0:00" && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{track.duration}</span>
          )}
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
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="mt-3 space-y-2 overflow-hidden rounded-xl">
                    {/* Lazy-loaded iframe — only mounts when expanded */}
                    <iframe
                      width="100%"
                      height="166"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      loading="lazy"
                      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(track.soundcloudUrl!)}&color=${track.color.replace("#", "%23")}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false`}
                      className="rounded-xl"
                      title={`${track.title} on SoundCloud`}
                    />
                    {/* SoundCloud attribution */}
                    <p className="text-right font-mono text-[9px] uppercase tracking-wider text-white/20">
                      Powered by{" "}
                      <a
                        href="https://soundcloud.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#ff5500]/60 transition hover:text-[#ff5500]"
                      >
                        SoundCloud
                      </a>
                    </p>
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
  const [duration, setDuration] = useState(0);
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
    const onLoaded = () => { if (audioRef.current) setDuration(audioRef.current.duration || 0); };
    const onEnded = () => { setIsPlaying(false); handleNext(); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
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
      setProgress(0);
      setDuration(0);
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
              <p className="mt-3 font-mono text-sm uppercase tracking-wider text-white/40">{heroTrack.artist} · {heroTrack.genre} · {heroTrack.mood}</p>
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

      {/* ===== LIVE FROM SOUNDCLOUD ===== */}
      <section className="relative z-10 mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal delay={0.1}>
          <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-plasma/80">
                Live Feed
              </p>
              <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                Live from{" "}
                <a
                  href="https://soundcloud.com/xsytrance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-plasma transition hover:underline hover:underline-offset-4"
                >
                  SoundCloud
                </a>
              </h2>
            </div>
            <a
              href="https://soundcloud.com/xsytrance"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-plasma/30 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-plasma transition hover:bg-plasma/10"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.195-1.308-.21-1.332c-.01-.057-.054-.094-.063-.094zm1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.106.104.061 0 .12-.044.12-.104l.24-2.474-.255-2.547c0-.06-.045-.104-.106-.104zm.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.255-2.64c-.015-.075-.06-.135-.151-.135zm.93-.069c0-.09-.075-.156-.165-.156-.09 0-.165.066-.18.156l-.18 2.7.195 2.52c.015.09.09.168.18.168.09 0 .165-.078.165-.168l.21-2.52-.225-2.7zm.93-.006c-.09 0-.165.066-.18.162l-.165 2.718.18 2.494c.016.09.09.162.18.162.089 0 .164-.072.164-.162l.195-2.494-.195-2.718c0-.096-.075-.162-.179-.162zm.915-.27c-.105 0-.18.09-.195.18l-.165 2.988.18 2.424c.015.105.09.18.18.18.104 0 .18-.09.195-.18l.195-2.424-.195-2.988c-.015-.105-.09-.18-.195-.18zm.96-.309c-.105 0-.18.09-.195.195l-.15 3.297.165 2.37c.015.105.09.195.195.195.105 0 .18-.09.195-.195l.18-2.37-.18-3.297c-.015-.12-.09-.195-.21-.195zm.99-.24c-.12 0-.21.105-.225.21l-.135 3.537.15 2.34c.016.119.105.21.225.21.119 0 .21-.105.225-.21l.165-2.34-.165-3.537c-.015-.12-.105-.21-.24-.21zm1.02-.225c-.135 0-.24.12-.255.24l-.12 3.762.135 2.31c.016.135.12.24.255.24.135 0 .24-.12.255-.24l.15-2.31-.15-3.762c-.015-.135-.12-.24-.27-.24zm.99-.03c-.135 0-.255.135-.27.27l-.105 3.792.12 2.28c.015.15.135.27.27.27.149 0 .27-.135.27-.27l.135-2.28-.135-3.792c0-.15-.12-.27-.285-.27zm1.02-.09c-.15 0-.27.15-.285.3l-.09 3.882.105 2.25c.015.15.15.285.285.285.165 0 .285-.15.3-.285l.12-2.25-.12-3.882c-.015-.165-.135-.3-.315-.3zm.99-.12c-.165 0-.3.165-.315.33l-.075 4.002.09 2.22c.015.165.165.315.33.315.165 0 .315-.165.33-.33l.105-2.205-.105-4.002c-.015-.18-.165-.33-.345-.33zm1.005-.18c-.18 0-.33.18-.345.36l-.045 4.182.06 2.175c.015.18.18.345.36.345.18 0 .345-.18.36-.36l.075-2.16-.075-4.182c-.015-.195-.18-.36-.375-.36zm2.01-2.13c-.21 0-.375.18-.39.39l-.015 1.26-.015 2.97.045 2.205c.015.21.195.39.405.39.225 0 .405-.195.405-.42l.015-2.175-.015-4.23c-.015-.225-.195-.39-.435-.39zm1.005.21c-.24 0-.42.225-.42.465l-.015 4.02.03 2.145c.015.24.225.435.45.435.255 0 .45-.225.45-.465l.015-2.115-.015-4.02c0-.255-.225-.465-.495-.465zm.99.24c-.27 0-.48.255-.48.525l-.015 3.78.045 2.1c0 .27.24.495.495.495.27 0 .495-.255.495-.54l-.015-2.055-.015-3.78c0-.285-.24-.525-.51-.525zm1.005.27c-.3 0-.525.285-.525.585l-.015 3.51.075 2.055c0 .3.27.54.555.54.3 0 .54-.285.54-.6l-.03-1.995-.03-3.51c0-.315-.27-.585-.57-.585zm.99.27c-.33 0-.585.315-.585.645l-.015 3.24.09 2.01c.015.33.3.6.615.6.345 0 .6-.315.6-.66l-.045-1.95-.045-3.24c0-.345-.3-.645-.615-.645z" />
              </svg>
              @xsytrance
            </a>
          </div>
          <SoundCloudEmbed url="https://soundcloud.com/xsytrance" />
        </ScrollReveal>
      </section>

      {/* ===== PLAYER BAR ===== */}
      <AnimatePresence>
        {currentTrack && currentTrack.audioUrl && (
          <PlayerBar track={currentTrack} isPlaying={isPlaying} progress={progress} duration={duration} onToggle={togglePlay} onSeek={handleSeek} onNext={handleNext} onPrev={handlePrev} />
        )}
      </AnimatePresence>
    </main>
  );
}
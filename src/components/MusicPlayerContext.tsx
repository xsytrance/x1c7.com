"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { type Track } from "@/data/tracks";
import { SignalEngine } from "@/audio/SignalEngine";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
  currentIndex: number;
  /** Live Web-Audio analyser, or null when the source is cross-origin without CORS. */
  analyser: AnalyserNode | null;
}

interface PlayerContext extends PlayerState {
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
}

const Context = createContext<PlayerContext | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const fellBackRef = useRef(false);
  const volumeRef = useRef(volume);
  // Latest queue/index for the "ended" handler, which is bound once on mount.
  const queueRef = useRef<Track[]>(queue);
  const indexRef = useRef(currentIndex);
  const advanceRef = useRef<() => void>(() => {});

  // Create the audio element + analyser exactly once. We try a CORS-cleared
  // element so the cross-origin media can be analysed for the visualizer + the
  // beat-reactive site theme. If the media fails to load under crossOrigin
  // (CORS missing), we transparently fall back to a plain element with direct
  // playback (no analyser — the synthetic visualizer takes over).
  useEffect(() => {
    const onTime = () => { const a = audioRef.current; if (a) setProgress(a.currentTime); };
    const onLoaded = () => { const a = audioRef.current; if (a) setDuration(a.duration || 0); };
    const onEnded = () => { setIsPlaying(false); advanceRef.current(); };

    const attach = (a: HTMLAudioElement) => {
      a.addEventListener("timeupdate", onTime);
      a.addEventListener("loadedmetadata", onLoaded);
      a.addEventListener("durationchange", onLoaded);
      a.addEventListener("ended", onEnded);
    };
    const detach = (a: HTMLAudioElement) => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("ended", onEnded);
    };

    const audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    attach(audio);

    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ac = new AC();
        ctxRef.current = ac;
        const source = ac.createMediaElementSource(audio);
        const an = ac.createAnalyser();
        an.fftSize = 512;
        an.smoothingTimeConstant = 0.85;
        source.connect(an);
        an.connect(ac.destination);
        setAnalyser(an);
      }
    } catch {
      /* analyser unavailable — synthetic visualizer will be used */
    }

    const onError = () => {
      if (fellBackRef.current) return;
      fellBackRef.current = true;
      const src = audio.src;
      const wasPlaying = !audio.paused;
      detach(audio);
      audio.removeEventListener("error", onError);
      try { audio.pause(); } catch { /* noop */ }
      try { ctxRef.current?.close(); } catch { /* noop */ }
      ctxRef.current = null;
      setAnalyser(null);

      const plain = new Audio();
      plain.preload = "metadata";
      plain.volume = volumeRef.current;
      audioRef.current = plain;
      attach(plain);
      if (src) {
        plain.src = src;
        if (wasPlaying) plain.play().catch(() => {});
      }
    };
    audio.addEventListener("error", onError);

    return () => {
      const a = audioRef.current;
      if (a) { detach(a); try { a.pause(); } catch { /* noop */ } }
      audio.removeEventListener("error", onError);
      try { ctxRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  // Drive progress off rAF for a smoother playhead than timeupdate alone.
  useEffect(() => {
    if (!isPlaying) return;
    const update = () => {
      const a = audioRef.current;
      if (a) setProgress(a.currentTime);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      // Keep index aligned within the existing queue when possible.
      const idx = queueRef.current.findIndex((t) => t.id === track.id);
      if (idx >= 0) setCurrentIndex(idx);
    }

    // Tracks without audio still surface in the player bar as "coming soon".
    if (!track.audioUrl) {
      setCurrentTrack(track);
      setIsPlaying(false);
      return;
    }

    const isSame = audio.src === track.audioUrl;
    if (!isSame) {
      audio.src = track.audioUrl;
      setProgress(0);
      setDuration(0);
      // Ambient bed is best-effort — a Web-Audio failure must never abort
      // track selection (e.g. no audio device / headless).
      try { SignalEngine.tuneIn(track); } catch { /* noop */ }
    }
    audio.volume = volumeRef.current;
    setCurrentTrack(track);
    ctxRef.current?.resume().catch(() => {});
    audio.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      try { SignalEngine.mute(); } catch { /* noop */ }
    } else {
      if (!audio.src) { audio.src = currentTrack.audioUrl; audio.volume = volumeRef.current; }
      ctxRef.current?.resume().catch(() => {});
      audio.play().catch(() => {});
      setIsPlaying(true);
      try { SignalEngine.tuneIn(currentTrack); } catch { /* noop */ }
    }
  }, [currentTrack, isPlaying]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    try { SignalEngine.mute(); } catch { /* noop */ }
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const track = q[(indexRef.current + 1) % q.length];
    if (track) playTrack(track);
  }, [playTrack]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    const track = q[(indexRef.current - 1 + q.length) % q.length];
    if (track) playTrack(track);
  }, [playTrack]);

  // Keep the once-bound handlers (ended auto-advance) and the latest
  // queue/index/volume readable from async callbacks, without touching refs
  // during render.
  useEffect(() => {
    queueRef.current = queue;
    indexRef.current = currentIndex;
    volumeRef.current = volume;
    advanceRef.current = next;
  });

  const seek = useCallback((time: number) => {
    if (audioRef.current) { audioRef.current.currentTime = time; setProgress(time); }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  return (
    <Context.Provider
      value={{
        currentTrack,
        isPlaying,
        progress,
        duration,
        volume,
        queue,
        currentIndex,
        analyser,
        playTrack,
        togglePlay,
        pause,
        next,
        prev,
        seek,
        setVolume,
      }}
    >
      {children}
    </Context.Provider>
  );
}

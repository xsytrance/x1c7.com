"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from "react";
import { type Track } from "@/data/tracks";
import { SignalEngine } from "@/audio/SignalEngine";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
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
  /** Imperative playhead read — for rAF-driven UIs that must not re-render per frame. */
  getCurrentTime: () => number;
  /** Muffle the music (0 = clear, 1 = underwater) — wipe moments drive this. */
  setMuffle: (amount: number) => void;
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
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const muffleRef = useRef<BiquadFilterNode | null>(null);
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
    // No per-frame progress state here — that would re-render every context
    // consumer (incl. the whole /music page) 60fps. MusicPlayerBar reads the
    // playhead itself via getCurrentTime().
    const onLoaded = () => { const a = audioRef.current; if (a) setDuration(a.duration || 0); };
    const onEnded = () => { setIsPlaying(false); advanceRef.current(); };

    const attach = (a: HTMLAudioElement) => {
      a.addEventListener("loadedmetadata", onLoaded);
      a.addEventListener("durationchange", onLoaded);
      a.addEventListener("ended", onEnded);
    };
    const detach = (a: HTMLAudioElement) => {
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
        // Muffle filter: a lowpass the lyric engine can drive (wipe moments
        // cover the SOUND too — the listener wipes the music clear).
        const lp = ac.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 20000; // wide open by default
        lp.Q.value = 0.5;
        muffleRef.current = lp;
        source.connect(lp);
        lp.connect(an);
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
    if (audioRef.current) audioRef.current.currentTime = time;
  }, []);

  const getCurrentTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);

  /** Muffle the music (0 = clear, 1 = deep underwater). Used by wipe
   * moments: the veil covers the sound; wiping restores it. Ramped so it
   * never clicks; a no-op when the WebAudio chain is unavailable (CORS). */
  const setMuffle = useCallback((amount: number) => {
    const lp = muffleRef.current;
    const ac = ctxRef.current;
    if (!lp || !ac) return;
    const x = Math.max(0, Math.min(1, amount));
    const freq = 300 + (1 - x) * (1 - x) * 19700; // 0 -> 20kHz, 1 -> 300Hz
    try {
      lp.frequency.cancelScheduledValues(ac.currentTime);
      lp.frequency.setTargetAtTime(freq, ac.currentTime, 0.18);
    } catch { /* noop */ }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  // Memoized so the value identity only changes on real state changes — never
  // per animation frame — which keeps every consumer (the whole /music page
  // included) from re-rendering 60fps.
  const value = useMemo(
    () => ({
      currentTrack, isPlaying, duration, volume, queue, currentIndex, analyser,
      playTrack, togglePlay, pause, next, prev, seek, setVolume, getCurrentTime, setMuffle,
    }),
    [currentTrack, isPlaying, duration, volume, queue, currentIndex, analyser,
     playTrack, togglePlay, pause, next, prev, seek, setVolume, getCurrentTime, setMuffle],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

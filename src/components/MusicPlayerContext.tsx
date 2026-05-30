"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { type Track } from "@/data/tracks";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
  currentIndex: number;
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      // Auto-play next
      if (queue.length > 0) {
        const nextIndex = (currentIndex + 1) % queue.length;
        const nextTrack = queue[nextIndex];
        if (nextTrack) {
          setCurrentTrack(nextTrack);
          setCurrentIndex(nextIndex);
          audio.src = nextTrack.audioUrl || "";
          audio.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [queue, currentIndex]);

  // Update progress
  useEffect(() => {
    if (!isPlaying) return;
    const update = () => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    // For now, tracks without audioUrl will just show "coming soon" behavior
    if (!track.audioUrl) {
      setCurrentTrack(track);
      setIsPlaying(false);
      return;
    }

    setCurrentTrack(track);
    audio.src = track.audioUrl;
    audio.volume = volume;
    audio.play().catch(() => {});
    setIsPlaying(true);
    setProgress(0);

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    }
  }, [volume]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!audio.src && currentTrack.audioUrl) {
        audio.src = currentTrack.audioUrl;
        audio.volume = volume;
      }
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, volume]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    const nextIndex = (currentIndex + 1) % queue.length;
    const track = queue[nextIndex];
    if (track) playTrack(track);
  }, [queue, currentIndex, playTrack]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    const track = queue[prevIndex];
    if (track) playTrack(track);
  }, [queue, currentIndex, playTrack]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
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

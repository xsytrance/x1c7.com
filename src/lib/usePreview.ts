"use client";
// Preview engine — a throwaway audio path for hover/tap previews, separate from
// the main MusicPlayerContext so previews never disturb the real queue.
// Sound design: previews fade in through a lowpass sweep (muffled → open),
// like stepping out of the hallway into the club.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/data/tracks";
import { loadStems, type StemData } from "@/lib/stemSense";
import { hotMoment, stemsUrlFor } from "@/lib/collection";
import { uiStore } from "@/lib/uiStore";

export interface PreviewState {
  id: string | null;      // track currently previewing
  blocked: boolean;       // autoplay blocked — needs one user gesture
  stems: StemData | null; // stems of the previewing track (for visuals)
  startAt: number;        // where the preview dropped in
}

const stemsCache = new Map<string, Promise<StemData | null>>();
export function stemsFor(track: Track): Promise<StemData | null> {
  const url = stemsUrlFor(track);
  if (!url) return Promise.resolve(null);
  let p = stemsCache.get(url);
  if (!p) {
    p = loadStems(url).catch(() => null);
    stemsCache.set(url, p);
  }
  return p;
}

export function usePreview(onStart?: () => void) {
  const [state, setState] = useState<PreviewState>({ id: null, blocked: false, stems: null, startAt: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const wiredRef = useRef(false);
  const sessionRef = useRef(0);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    audioRef.current = a;
    return a;
  }, []);

  // Wire the WebAudio sweep lazily; if CORS kills the graph, fall back to plain audio.
  const wire = useCallback((a: HTMLAudioElement) => {
    if (wiredRef.current) return;
    wiredRef.current = true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(a);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 18000;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      ctxRef.current = ctx; gainRef.current = gain; filterRef.current = filter;
    } catch {
      ctxRef.current = null; gainRef.current = null; filterRef.current = null;
    }
  }, []);

  const sweepIn = useCallback(() => {
    const ctx = ctxRef.current, gain = gainRef.current, filter = filterRef.current;
    const a = audioRef.current;
    if (ctx && gain && filter && ctx.state !== "closed") {
      ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.55);
      filter.frequency.cancelScheduledValues(t);
      filter.frequency.setValueAtTime(420, t);
      filter.frequency.exponentialRampToValueAtTime(17500, t + 0.9);
    } else if (a) {
      a.volume = 0.9;
    }
  }, []);

  const stop = useCallback((fade = true) => {
    sessionRef.current++;
    const a = audioRef.current;
    if (!a) return;
    const ctx = ctxRef.current, gain = gainRef.current;
    if (fade && ctx && gain && !a.paused) {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value || 0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      const snap = sessionRef.current;
      window.setTimeout(() => { if (sessionRef.current === snap) a.pause(); }, 240);
    } else {
      a.pause();
    }
    setState((s) => (s.id ? { ...s, id: null, stems: null } : s));
  }, []);

  const start = useCallback(async (track: Track) => {
    if (!track.audioUrl) return;
    // The cinematic stage owns the audio — a preview here would pause the main
    // player mid-show and freeze the show clock (heard music, no lyrics).
    if (uiStore.isCinematic()) return;
    const session = ++sessionRef.current;
    const a = ensureAudio();
    wire(a);
    onStart?.();
    const stems = await stemsFor(track);
    if (sessionRef.current !== session) return; // superseded while loading
    if (uiStore.isCinematic()) return; // a show opened during the stems fetch
    const at = stems ? hotMoment(stems) : NaN;
    if (a.src !== track.audioUrl) a.src = track.audioUrl;
    const begin = () => {
      if (sessionRef.current !== session) return;
      if (uiStore.isCinematic()) return; // a show opened while media loaded
      const t0 = Number.isFinite(at) ? at : (a.duration ? a.duration * 0.3 : 30);
      try { a.currentTime = t0; } catch { /* not seekable yet */ }
      sweepIn();
      a.play().then(() => {
        if (sessionRef.current !== session) { a.pause(); return; }
        setState({ id: track.id, blocked: false, stems, startAt: t0 });
      }).catch(() => {
        setState((s) => ({ ...s, blocked: true }));
      });
    };
    if (a.readyState >= 1) begin();
    else a.addEventListener("loadedmetadata", begin, { once: true });
    a.load();
  }, [ensureAudio, wire, sweepIn, onStart]);

  /** Imperative playhead for progress rings — never causes re-renders. */
  const getTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);
  const getDuration = useCallback(() => audioRef.current?.duration ?? 0, []);

  useEffect(() => () => { audioRef.current?.pause(); void ctxRef.current?.close?.(); }, []);

  return useMemo(() => ({ state, start, stop, getTime, getDuration }), [state, start, stop, getTime, getDuration]);
}

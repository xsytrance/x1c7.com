"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useAudioAnalyzer() {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  const initAudio = useCallback((audioElement: HTMLAudioElement) => {
    if (contextRef.current) return; // Already initialized

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    contextRef.current = ctx;

    const source = ctx.createMediaElementSource(audioElement);
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 512;
    analyserNode.smoothingTimeConstant = 0.85;

    source.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    setAnalyser(analyserNode);
    audioRef.current = audioElement;
  }, []);

  useEffect(() => {
    return () => {
      if (contextRef.current) {
        contextRef.current.close();
        contextRef.current = null;
      }
    };
  }, []);

  return { analyser, initAudio };
}

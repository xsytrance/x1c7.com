"use client";

import { useEffect, useRef, useCallback } from "react";
import { uiStore } from "@/lib/uiStore";
import { detectLite } from "@/lib/perf";

interface VisualizerProps {
  analyser: AnalyserNode | null;
  /** When true (and no real analyser), draw a synthetic animated spectrum. */
  active?: boolean;
  color?: string;
  className?: string;
  mode?: "bars" | "wave" | "radial";
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function ampColor(val: number, color: string): [number, number, number] {
  const [r, g, b] = hexToRgb(color);
  return [
    Math.round(r * val + 20 * (1 - val)),
    Math.round(g * val + 40 * (1 - val)),
    Math.round(b * val + 60 * (1 - val)),
  ];
}

export function AudioVisualizer({ analyser, active = false, color = "#ff2440", className = "", mode = "bars" }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const freqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const liteRef = useRef(false);

  const draw = useCallback(() => {
    if (!canvasRef.current) return;

    // Idle while the cinematic lyrics takeover is up (this canvas is occluded).
    if (uiStore.isCinematic()) { animRef.current = requestAnimationFrame(draw); return; }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sizing, DPR transform, and buffer allocation live in the mount effect —
    // the hot loop only reads audio data and draws.
    const { w, h } = sizeRef.current;
    const glow = !liteRef.current;

    let freqData: Uint8Array<ArrayBuffer>;
    let timeData: Uint8Array<ArrayBuffer>;

    if (analyser) {
      // Real frequency data (requires a same-origin / CORS-cleared source).
      if (analyser.fftSize !== 512) analyser.fftSize = 512;
      if (!freqRef.current || freqRef.current.length !== analyser.frequencyBinCount) {
        freqRef.current = new Uint8Array(analyser.frequencyBinCount);
        timeRef.current = new Uint8Array(analyser.fftSize);
      }
      freqData = freqRef.current;
      timeData = timeRef.current!;
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
    } else {
      // Synthetic spectrum — keeps the visualizer alive when the audio source
      // is cross-origin (can't be analysed) but still playing.
      const binCount = 256;
      const fftSize = 512;
      if (!freqRef.current || freqRef.current.length !== binCount) {
        freqRef.current = new Uint8Array(binCount);
        timeRef.current = new Uint8Array(fftSize);
      }
      freqData = freqRef.current;
      timeData = timeRef.current!;
      const t = performance.now() / 1000;
      for (let i = 0; i < binCount; i++) {
        const f = i / binCount;
        const env = Math.pow(1 - f, 1.7); // bass-heavy falloff
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + f * 9);
        const wob = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 0.27);
        const kick = 0.5 + 0.5 * Math.sin(t * 6.2);
        freqData[i] = Math.min(255, env * 255 * (0.3 + 0.7 * pulse * wob) * (0.7 + 0.3 * kick));
      }
      for (let i = 0; i < fftSize; i++) {
        const x = i / fftSize;
        timeData[i] = 128 + Math.sin(x * Math.PI * 8 + t * 6) * 46 * (0.4 + 0.6 * Math.sin(t * 1.7));
      }
    }

    ctx.clearRect(0, 0, w, h);

    if (mode === "bars") {
      const count = 64;
      const gap = 2;
      const barW = (w - gap * (count - 1)) / count;

      for (let i = 0; i < count; i++) {
        const dataI = Math.floor((i / count) * freqData.length * 0.75);
        const val = freqData[dataI] / 255;
        const barH = Math.max(2, val * h * 0.92);
        const x = i * (barW + gap);
        const [r, g, b] = ampColor(val, color);

        const grad = ctx.createLinearGradient(x, h - barH, x, h);
        grad.addColorStop(0, `rgba(${r},${g},${b},1.0)`);
        grad.addColorStop(0.6, `rgba(${r},${g},${b},0.7)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0.2)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, h - barH, barW, barH);

        // Peak highlight (shadowBlur is expensive on mobile — perf-lite skips it)
        if (glow) {
          ctx.shadowColor = `rgb(${r},${g},${b})`;
          ctx.shadowBlur = 6;
        }
        ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
        ctx.fillRect(x, h - barH, barW, 2);
        if (glow) ctx.shadowBlur = 0;
      }
    } else if (mode === "wave") {
      const sliceW = w / timeData.length;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const [r, g, b] = hexToRgb(color);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
      grad.addColorStop(0.5, `rgba(${Math.round(r*0.8)},${Math.round(g*1.2)},${Math.round(b*1.1)},0.9)`);
      grad.addColorStop(1, `rgba(${Math.round(r*1.2)},${Math.round(g*0.8)},${b},0.9)`);
      ctx.strokeStyle = grad;
      if (glow) {
        ctx.shadowColor = `rgba(${r},${g},${b},0.4)`;
        ctx.shadowBlur = 10;
      }

      ctx.beginPath();
      for (let i = 0; i < timeData.length; i++) {
        const y = (timeData[i] / 128) * (h / 2);
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
      if (glow) ctx.shadowBlur = 0;
    } else if (mode === "radial") {
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.26;
      const count = 96;

      for (let i = 0; i < count; i++) {
        const dataI = Math.floor((i / count) * freqData.length * 0.8);
        const val = freqData[dataI] / 255;
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const barLen = val * radius * 0.9;
        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + barLen);
        const y2 = cy + Math.sin(angle) * (radius + barLen);
        const [r, g, b] = ampColor(val, color);

        ctx.strokeStyle = `rgba(${r},${g},${b},${0.5 + val * 0.5})`;
        ctx.lineWidth = 2;
        if (glow) {
          ctx.shadowColor = `rgb(${r},${g},${b})`;
          ctx.shadowBlur = val * 10;
        }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      if (glow) ctx.shadowBlur = 0;
    }

    animRef.current = requestAnimationFrame(draw);
  }, [analyser, color, mode]);

  useEffect(() => {
    if (!analyser && !active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    liteRef.current = detectLite();

    // Resizing the backing store clears + reallocates the whole canvas, and
    // offsetWidth forces layout — do it only when the element actually resizes.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      sizeRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    animRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
    };
  }, [analyser, active, draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}

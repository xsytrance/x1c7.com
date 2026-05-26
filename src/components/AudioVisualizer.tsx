"use client";

import { useReducedMotion } from "framer-motion";

interface AudioVisualizerProps {
  barCount?: number;
  color?: string;
  className?: string;
}

export function AudioVisualizer({ barCount = 7, color = "#ff2bd6", className = "" }: AudioVisualizerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: color,
            height: "24px",
            opacity: 0.8,
            animation: reduceMotion ? "none" : `visualizerBounce ${0.8 + i * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

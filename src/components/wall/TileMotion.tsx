"use client";
// THE MINI SHOW — a tile's motion layer.
//
// Not a video. This is the song's OWN generated planet art (the same paintings
// the full Kinetic show performs with) drifting and cross-fading, graded in the
// song's OWN palette, with the lyric word each painting was generated FOR
// igniting over it. 54 of 56 songs already have this art in R2, so the wall
// came alive without rendering a single frame.
//
// P2 replaces this with a real rendered Kinetica loop where one exists; this
// stays as the fallback for every song that has no loop yet.
//
// PERF: this component only exists while the wall's scheduler has granted this
// tile one of its few motion slots (see useWallMotion in Wall.tsx). Everything
// inside animates in CSS — no rAF, no React ticks except the frame advance.

import { useEffect, useState } from "react";
import type { MotionFrame } from "@/lib/wall";

/* eslint-disable @next/next/no-img-element */

const FRAME_MS = 2600;

export function TileMotion({ frames, palette, wordPx }: {
  frames: MotionFrame[];
  palette: string[];
  /** word size in px, scaled to the tile; 0 = tile too small for a legible
   *  word, so it runs as art only */
  wordPx: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (frames.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % frames.length), FRAME_MS);
    return () => clearInterval(t);
  }, [frames.length]);

  if (!frames.length) return null;
  const grade = palette[0] || null;
  const glow = palette[1] || palette[0] || "#ffffff";
  const frame = frames[i];

  return (
    <span className="wall-motion pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {frames.map((f, n) => (
        <img
          key={f.url}
          src={f.url}
          alt=""
          loading="lazy"
          draggable={false}
          className={`wall-motion__frame ${n === i ? "is-on" : ""}`}
          // alternate the drift direction so a tile never pulses in one rhythm
          style={{ animationDirection: n % 2 ? "reverse" : "normal" }}
        />
      ))}

      {/* the song's own colour, laid over its own art */}
      {grade && (
        <span
          className="absolute inset-0 mix-blend-soft-light"
          style={{ background: `linear-gradient(150deg, ${grade}, transparent 65%)` }}
        />
      )}

      {/* the word this painting was generated for */}
      {wordPx > 0 && frame.word && (
        <span
          key={frame.url}
          className="wall-motion__word"
          style={{ color: glow, fontSize: wordPx, textShadow: `0 0 18px ${glow}, 0 2px 10px rgba(0,0,0,0.85)` }}
        >
          {frame.word}
        </span>
      )}
    </span>
  );
}

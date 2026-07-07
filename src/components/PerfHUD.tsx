"use client";

// A tiny frame-rate meter for measuring the show on a real device. Hidden by
// default — enable with `?fps=1` in the URL or `localStorage x1c7-fps = "on"`.
// Shows the rolling average FPS and the WORST frame time in the last second
// (the number that decides whether a show feels smooth or janky).

import { useEffect, useRef, useState } from "react";

export function PerfHUD() {
  const [on, setOn] = useState(false);
  const [fps, setFps] = useState(0);
  const [worst, setWorst] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let enabled = false;
    try {
      const q = new URLSearchParams(window.location.search).get("fps");
      enabled = q === "1" || q === "on" || localStorage.getItem("x1c7-fps") === "on";
    } catch {
      /* ignore */
    }
    if (!enabled) return;
    setOn(true);

    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let maxDt = 0;
    let windowStart = last;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      if (dt > maxDt) maxDt = dt;
      if (now - windowStart >= 500) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        setWorst(Math.round(maxDt));
        frames = 0;
        maxDt = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!on) return null;
  const good = fps >= 50;
  return (
    <div
      ref={box}
      className="pointer-events-none fixed left-3 bottom-24 z-[60] rounded-md border border-white/20 bg-black/70 px-2.5 py-1.5 font-mono text-[11px] leading-tight"
      style={{ color: good ? "#7CFFB2" : fps >= 30 ? "#ffd35c" : "#ff6a6a" }}
      aria-hidden
    >
      <div>{fps} fps</div>
      <div className="text-white/50">worst {worst}ms</div>
    </div>
  );
}

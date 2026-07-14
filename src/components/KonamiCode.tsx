"use client";

import { useState, useEffect, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export function KonamiCode() {
  const [progress, setProgress] = useState(0);
  const [activated, setActivated] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const expected = KONAMI[progress];
      const key = e.key.toLowerCase();

      if (key === expected.toLowerCase()) {
        const next = progress + 1;
        setProgress(next);

        // Show hint on first correct key
        if (next === 1) setShowHint(true);

        if (next === KONAMI.length) {
          setActivated(true);
          setProgress(0);
          setShowHint(false);
          // Auto-dismiss after 8 seconds
          setTimeout(() => setActivated(false), 8000);
        }
      } else {
        // Wrong key — reset unless they just started
        setProgress(0);
        setShowHint(false);
      }
    },
    [progress]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Progress hint */}
      <AnimatePresence>
        {showHint && !activated && progress > 0 && progress < KONAMI.length && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2"
          >
            <div className="rounded-full border border-white/10 bg-void/90 px-4 py-2 backdrop-blur-xl">
              <div className="flex items-center gap-1.5">
                {KONAMI.map((k, i) => {
                  const isDone = i < progress;
                  const isNext = i === progress;
                  return (
                    <span
                      key={i}
                      className={`font-mono text-[10px] uppercase transition ${
                        isDone ? "text-signal" : isNext ? "animate-pulse text-white" : "text-white/20"
                      }`}
                    >
                      {k.replace("Arrow", "")}
                    </span>
                  );
                })}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Full activation overlay */}
      <AnimatePresence>
        {activated && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none fixed inset-0 z-[55]"
          >
            {/* Scan lines */}
            <div
              className="absolute inset-0"
              style={{
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(141,255,74,0.03) 2px, rgba(141,255,74,0.03) 4px)",
              }}
            />

            {/* Corner brackets */}
            <div className="absolute left-4 top-4 h-12 w-12 border-l-2 border-t-2 border-signal/40" />
            <div className="absolute right-4 top-4 h-12 w-12 border-r-2 border-t-2 border-signal/40" />
            <div className="absolute bottom-4 left-4 h-12 w-12 border-b-2 border-l-2 border-signal/40" />
            <div className="absolute bottom-4 right-4 h-12 w-12 border-b-2 border-r-2 border-signal/40" />

            {/* Center badge */}
            <m.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="rounded-3xl border border-signal/30 bg-void/90 px-8 py-6 text-center backdrop-blur-xl shadow-2xl shadow-signal/10">
                <p className="animate-pulse font-mono text-[10px] uppercase tracking-[0.5em] text-signal/80">
                  Cheat Activated
                </p>
                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight text-white">
                  GOD MODE
                </p>
                <p className="mt-2 font-mono text-xs uppercase tracking-wider text-white/45">
                  You knew the code. Of course you did.
                </p>
                <div className="mt-4 flex justify-center gap-1">
                  {[0, 0.1, 0.2, 0.3, 0.4].map((d, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-6 rounded-full bg-signal"
                      style={{ animation: "visualizerBounce 0.5s ease-in-out infinite alternate", animationDelay: `${d}s` }}
                    />
                  ))}
                </div>
              </div>
            </m.div>

            {/* Status text */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal/40">
                All systems boosted · Signal enhanced
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

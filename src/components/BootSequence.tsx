"use client";

import { useState, useEffect, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";

const BOOT_LINES = [
  { text: "> INITIALIZING x1c7 SYSTEM...", delay: 200 },
  { text: "> LOADING PORTAL MAP...", delay: 800 },
  { text: "> [████████░░] 80%", delay: 1400 },
  { text: "> [██████████] 100%", delay: 1900 },
  { text: "> ESTABLISHING SIGNAL...", delay: 2400 },
  { text: "> CONNECTED", delay: 3000 },
  { text: "> WELCOME, OPERATOR.", delay: 3600 },
];

const STORAGE_KEY = "x1c7-boot-seen";

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<number[]>([]);
  const [exiting, setExiting] = useState(false);
  const skipped = useRef(false);

  useEffect(() => {
    // One-time ceremony: localStorage survives across sessions, so the boot
    // plays on a browser's first visit ever (or again after the user clears
    // site data). Old sessionStorage marks migrate silently.
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (seen) localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* storage blocked → play it, can't persist anyway */ }
    if (seen) {
      onComplete();
      return;
    }

    // Check reduced motion
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setVisible(true);

    if (reduced) {
      setLines(BOOT_LINES.map((_, i) => i));
      setTimeout(() => {
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* private mode */ };
        setExiting(true);
        setTimeout(onComplete, 600);
      }, 500);
      return;
    }

    // Type lines one by one
    BOOT_LINES.forEach((line, index) => {
      setTimeout(() => {
        if (!skipped.current) {
          setLines((prev) => [...prev, index]);
        }
      }, line.delay);
    });

    // Auto-dismiss after last line
    const lastDelay = BOOT_LINES[BOOT_LINES.length - 1].delay + 1200;
    const timer = setTimeout(() => {
      if (!skipped.current) {
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* private mode */ };
        setExiting(true);
        setTimeout(onComplete, 600);
      }
    }, lastDelay);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleSkip = () => {
    skipped.current = true;
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* private mode */ };
    setExiting(true);
    setTimeout(onComplete, 300);
  };

  return (
    <AnimatePresence>
      {visible && !exiting && (
        <m.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
          onClick={handleSkip}
        >
          {/* Terminal window */}
          <div className="w-full max-w-lg px-6">
            <div className="overflow-hidden rounded-2xl border border-signal/20 bg-black/80 p-6 shadow-2xl shadow-signal/10 backdrop-blur sm:p-8">
              {/* Top bar */}
              <div className="mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                <span className="h-3 w-3 rounded-full bg-plasma/60" />
                <span className="h-3 w-3 rounded-full bg-ember/60" />
                <span className="h-3 w-3 rounded-full bg-venom/60" />
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-white/30">
                  x1c7_bootloader_v3.0
                </span>
              </div>

              {/* Boot lines */}
              <div className="grid gap-2 font-mono text-sm">
                {lines.map((li) => (
                  <m.p
                    key={li}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={
                      li === BOOT_LINES.length - 1
                        ? "text-signal font-bold"
                        : li === 2
                          ? "text-ember"
                          : li === 3
                            ? "text-venom"
                            : "text-white/70"
                    }
                  >
                    {BOOT_LINES[li].text}
                  </m.p>
                ))}
                {/* Blinking cursor */}
                {lines.length > 0 && lines.length < BOOT_LINES.length && (
                  <span className="inline-block h-4 w-2 animate-pulse bg-signal/60" />
                )}
              </div>

              {/* Skip hint */}
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-white/20"
              >
                Click anywhere to skip
              </m.p>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

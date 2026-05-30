"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SIGNAL_WORD = "signal";
const LOGO_CLICK_THRESHOLD = 7;

export function EasterEggs() {
  const [signalFlash, setSignalFlash] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [typedBuffer, setTypedBuffer] = useState("");
  const [konamiTriggered, setKonamiTriggered] = useState(false);

  // "signal" typing easter egg
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      setTypedBuffer((prev) => {
        const next = (prev + e.key.toLowerCase()).slice(-SIGNAL_WORD.length);
        if (next === SIGNAL_WORD) {
          setSignalFlash(true);
          setTimeout(() => setSignalFlash(false), 600);
          return "";
        }
        return next;
      });
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Logo click counter
  const handleLogoClick = useCallback(() => {
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= LOGO_CLICK_THRESHOLD) {
        setShowSecret(true);
        return 0;
      }
      return next;
    });
  }, []);

  // Global click handler for logo
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if clicked on the x1c7 logo
      if (
        target.closest("a[href='/']") ||
        target.closest(".portal-ring") ||
        target.textContent?.toLowerCase().includes("x1c7")
      ) {
        handleLogoClick();
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [handleLogoClick]);

  // Secret key combinations per page
  useEffect(() => {
    const secretCodes: Record<string, string[]> = {
      "/classified": ["s", "e", "c", "r", "e", "t"],
      "/music": ["b", "e", "a", "t"],
      "/projects": ["h", "a", "c", "k"],
    };

    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const path = window.location.pathname;
      const code = secretCodes[path];
      if (!code) return;

      buffer += e.key.toLowerCase();
      if (buffer.length > code.length) {
        buffer = buffer.slice(-code.length);
      }

      if (buffer === code.join("")) {
        setKonamiTriggered(true);
        setTimeout(() => setKonamiTriggered(false), 2000);
        buffer = "";
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Click the void background = brief pulse
  useEffect(() => {
    let lastClickTime = 0;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If clicking on the body/main area (not interactive elements)
      if (target.tagName === "BODY" || target.tagName === "MAIN") {
        const now = Date.now();
        if (now - lastClickTime < 300) {
          // Double-click on void
          setSignalFlash(true);
          setTimeout(() => setSignalFlash(false), 400);
        }
        lastClickTime = now;
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      {/* Signal flash overlay */}
      <AnimatePresence>
        {signalFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none fixed inset-0 z-[80] bg-signal"
          />
        )}
      </AnimatePresence>

      {/* Logo click secret */}
      <AnimatePresence>
        {showSecret && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
            onAnimationComplete={() => setTimeout(() => setShowSecret(false), 2000)}
          >
            <div className="rounded-[2rem] border border-signal/30 bg-void/90 px-8 py-6 text-center backdrop-blur-xl">
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-signal/60">Secret Found</p>
              <p className="mt-2 font-display text-2xl font-black uppercase text-signal">
                The signal was always here.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page-specific secret flash */}
      <AnimatePresence>
        {konamiTriggered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none fixed inset-0 z-[80]"
            style={{
              background: `radial-gradient(circle at 50% 50%, var(--plasma), transparent 60%)`,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

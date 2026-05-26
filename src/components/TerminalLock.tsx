"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const TERMINAL_LINES = [
  { text: "> INITIALIZING SECURITY SCAN...", delay: 300, color: "text-signal" },
  { text: "> VERIFYING CLEARANCE LEVEL...", delay: 1200, color: "text-white/70" },
  { text: "> ACCESS DENIED.", delay: 2400, color: "text-red-400" },
  { text: "> LEVEL 7 CLEARANCE REQUIRED.", delay: 3200, color: "text-red-400/80" },
  { text: "> WAIT...", delay: 4500, color: "text-ember" },
  { text: "> SCANNING FOR BACKDOORS...", delay: 5200, color: "text-white/60" },
  { text: "> ANOMALY DETECTED.", delay: 6800, color: "text-plasma" },
  { text: "> The signal was inside you all along.", delay: 8000, color: "text-venom" },
  { text: "> [END TRANSMISSION]", delay: 9500, color: "text-white/40" },
];

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export function TerminalLock() {
  const [lines, setLines] = useState<number[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [konamiIdx, setKonamiIdx] = useState(0);
  const [konamiOn, setKonamiOn] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    TERMINAL_LINES.forEach((line, index) => {
      const t = setTimeout(() => setLines((p) => [...p, index]), line.delay);
      return () => clearTimeout(t);
    });
    const t = setTimeout(() => setShowPrompt(true), 10500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === KONAMI[konamiIdx]) {
        const n = konamiIdx + 1;
        setKonamiIdx(n);
        if (n === KONAMI.length) { setKonamiOn(true); setKonamiIdx(0); }
      } else {
        setKonamiIdx(0);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [konamiIdx]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setAttempts((c) => c + 1);
    setShake(true);
    setInput("");
    setTimeout(() => setShake(false), 400);
  }, []);

  return (
    <div className="w-full max-w-2xl">
      {/* Blinking red light */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <span className="relative inline-flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-red-400/80">Security Lock Active</span>
      </div>

      {/* Terminal */}
      <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-black/60 p-5 font-mono text-sm shadow-2xl shadow-red-900/20 backdrop-blur sm:p-8">
        <div className="mb-4 border-b border-white/5 pb-3">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">x1c7_secure_terminal_v2.1</span>
        </div>

        <div className="grid gap-2">
          <AnimatePresence>
            {lines.map((li) => (
              <motion.p
                key={li}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className={TERMINAL_LINES[li].color}
              >
                {TERMINAL_LINES[li].text}
              </motion.p>
            ))}
          </AnimatePresence>

          {showPrompt && (
            <motion.form
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit}
              className={`mt-4 flex items-center gap-2 ${shake ? "animate-shake" : ""}`}
            >
              <span className="text-red-400/60">&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ENTER ACCESS CODE"
                className="flex-1 border-none bg-transparent font-mono text-sm uppercase tracking-wider text-white outline-none placeholder:text-white/20"
                autoComplete="off"
                autoFocus
              />
            </motion.form>
          )}

          {attempts > 0 && !konamiOn && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-white/30">
              Invalid code. Attempt {attempts} logged.
            </motion.p>
          )}
        </div>

        <AnimatePresence>
          {konamiOn && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 rounded-xl border border-venom/30 bg-venom/10 p-4 text-center"
            >
              <pre className="text-xs leading-5 text-venom sm:text-sm">{`
    ██╗  ██╗███████╗██╗   ██╗
    ╚██╗██╔╝██╔════╝╚██╗ ██╔╝
     ╚███╔╝ ███████╗ ╚████╔╝
     ██╔██╗ ╚════██║  ╚██╔╝
    ██╔╝ ██╗███████║   ██║
    ╚═╝  ╚═╝╚══════╝   ╚═╝

    The signal finds those
    who know where to look.
              `}</pre>
              <p className="mt-2 text-xs text-venom/70">Welcome to the inner frequency.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

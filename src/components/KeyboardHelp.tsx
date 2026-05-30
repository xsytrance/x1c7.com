"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHORTCUTS = [
  { key: "1–9", action: "Jump to portal" },
  { key: "↑↓←→", action: "Navigate portal map" },
  { key: "Enter", action: "Open selected portal" },
  { key: "?", action: "Toggle this help" },
  { key: "Esc", action: "Close overlay" },
];

const PORTALS = [
  { num: "1", label: "Hub", route: "/" },
  { num: "2", label: "Music", route: "/music" },
  { num: "3", label: "Projects", route: "/projects" },
  { num: "4", label: "Classified", route: "/classified" },
  { num: "5", label: "AI Art", route: "/art" },
  { num: "6", label: "War Room", route: "/war-room" },
  { num: "7", label: "Level Ready", route: "/level-ready" },
  { num: "8", label: "Agents", route: "/agents" },
  { num: "9", label: "Field Notes", route: "/notes" },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((p) => !p);
    window.addEventListener("x1c7-toggle-help", toggle);
    return () => window.removeEventListener("x1c7-toggle-help", toggle);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-4 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-void/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-signal/80">x1c7 controls</p>
            <h2 className="mt-3 font-display text-2xl font-black uppercase tracking-tight">Keyboard Shortcuts</h2>

            {/* Portal map */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {PORTALS.map((p) => (
                <a
                  key={p.route}
                  href={p.route}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 transition hover:border-white/15 hover:bg-white/[0.06]"
                  onClick={() => setOpen(false)}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 font-mono text-[10px] text-white/50">
                    {p.num}
                  </span>
                  <span className="text-xs text-white/70">{p.label}</span>
                </a>
              ))}
            </div>

            {/* Shortcuts */}
            <div className="mt-5 border-t border-white/5 pt-4">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between py-1.5">
                  <span className="font-mono text-xs text-white/50">{s.action}</span>
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70">
                    {s.key}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-full border border-white/10 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white/50 transition hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to console for debugging
    console.error("x1c7 error:", error);
  }, [error]);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-red-500/20 bg-white/[0.06] p-8 text-center shadow-2xl shadow-red-900/20 backdrop-blur-xl sm:p-12"
      >
        <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/15 blur-3xl" />

        {/* Blinking red light */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="relative inline-flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-red-400/80">System Error</span>
        </div>

        <p className="relative font-mono text-xs uppercase tracking-[0.45em] text-red-400/60">x1c7 critical</p>

        <h1 className="relative mt-5 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-6xl">
          <span className="inline-block animate-pulse text-red-400">S</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "0.1s" }}>i</span>
          <span className="inline-block animate-pulse text-red-400/60" style={{ animationDelay: "0.2s" }}>g</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "0.3s" }}>n</span>
          <span className="inline-block animate-pulse text-red-400" style={{ animationDelay: "0.4s" }}>a</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "0.5s" }}>l</span>
          <span className="mx-2 inline-block text-white/20"> </span>
          <span className="inline-block animate-pulse text-red-400/60" style={{ animationDelay: "0.2s" }}>D</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "0.3s" }}>i</span>
          <span className="inline-block animate-pulse text-red-400" style={{ animationDelay: "0.4s" }}>s</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "0.5s" }}>r</span>
          <span className="inline-block animate-pulse text-red-400/60" style={{ animationDelay: "0.6s" }}>u</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "0.7s" }}>p</span>
          <span className="inline-block animate-pulse text-red-400" style={{ animationDelay: "0.8s" }}>t</span>
          <span className="inline-block animate-pulse text-red-400/60" style={{ animationDelay: "0.9s" }}>e</span>
          <span className="inline-block animate-pulse text-red-400/80" style={{ animationDelay: "1.0s" }}>d</span>
        </h1>

        <p className="relative mx-auto mt-6 max-w-md text-lg font-semibold leading-8 text-white/75">
          Something went wrong behind the scenes. The signal is scrambled.
        </p>

        {error.digest && (
          <p className="relative mx-auto mt-3 max-w-md font-mono text-xs text-white/30">
            Error ID: {error.digest}
          </p>
        )}

        <div className="relative mt-10 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-signal"
          >
            Retry Signal
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-signal hover:text-white"
          >
            Return to hub
          </Link>
        </div>
      </motion.section>
    </main>
  );
}

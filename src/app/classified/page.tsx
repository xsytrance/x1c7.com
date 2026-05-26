"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { TerminalLock } from "@/components/TerminalLock";
import { BackToHub } from "@/components/BackToHub";

export default function Page() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <BackToHub />
      </div>

      <section className="relative z-10 flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Header */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-red-400/60">x1c7 secure channel</p>
            <h1 className="mt-5 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-7xl">Classified</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg font-semibold leading-8 text-white/75">
              Access denied-ish. Nothing sensitive. Just a locked portal.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/55">
              Some doors stay closed until the signal is ready.
            </p>
          </motion.div>

          {/* Terminal */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex justify-center"
          >
            <TerminalLock />
          </motion.div>

          {/* Hint */}
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 font-mono text-[10px] uppercase tracking-wider text-white/25"
          >
            Tip: Try the keyboard. Or don&apos;t. The door decides.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="mt-8 flex flex-wrap justify-center gap-3"
          >
            <Link href="/" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-red-400">Back to hub</Link>
            <Link href="/classified" className="rounded-full border border-red-400/30 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-red-400/80 transition hover:border-red-400 hover:text-red-400">Try locked door</Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

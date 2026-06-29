"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { GuideList } from "@/components/GuideList";
import { guides } from "@/data/guides";

export default function GuidesPage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="starfield" aria-hidden />
      <div className="scanline" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: "#43f7ff" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Nav */}
        <nav className="mb-8 flex items-center justify-between">
          <BackToHub />
          <Link
            href="/projects"
            className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55 transition hover:border-white/40 hover:text-white"
          >
            projects →
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-signal/80">
            x1c7 field manual
          </p>
          <TextScramble
            text="Field Manual"
            as="h1"
            className="mt-4 font-display text-5xl font-black uppercase tracking-[-0.06em] text-white sm:text-7xl glow-text"
            delay={100}
          />
          <p className="mt-5 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
            How-tos, AI playbooks, and field-tested ways to use the machines.
            Declassified protocols from the lab — tap any file to expand the steps.
          </p>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/35"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-venom" />
            {guides.length} protocols declassified · more incoming
          </motion.div>
        </header>

        {/* Guides */}
        <ScrollReveal>
          <GuideList />
        </ScrollReveal>

        {/* Bottom nav */}
        <ScrollReveal delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 pb-8">
            <Link
              href="/"
              className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-signal"
            >
              Back to hub
            </Link>
            <Link
              href="/notes"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-venom hover:text-white"
            >
              Field notes
            </Link>
          </div>
        </ScrollReveal>

        {/* Footer */}
        <footer className="pb-4 text-center font-mono text-[10px] text-white/20">
          <span className="text-signal/40">▤</span> x1c7 field manual — declassified
        </footer>
      </div>
    </main>
  );
}

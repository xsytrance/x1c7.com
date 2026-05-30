"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { PortalMap } from "@/components/PortalMap";
import { MobileNav } from "@/components/MobileNav";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";

export default function Home() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />

      {/* Header */}
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="portal-ring grid h-11 w-11 place-items-center rounded-2xl p-[2px] shadow-glow">
            <span className="grid h-full w-full place-items-center rounded-2xl bg-void font-black">x</span>
          </span>
          <span>
            <span className="block font-display text-xl font-black tracking-[0.32em]">x1c7</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">creative hub</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 font-mono text-xs uppercase tracking-[0.25em] text-white/55 sm:flex">
          <a className="transition hover:text-signal" href="#map">Map</a>
          <a className="transition hover:text-plasma" href="#signal">Signal</a>
          <Link className="transition hover:text-venom" href="/classified">Locked</Link>
        </nav>

        {/* Mobile nav */}
        <MobileNav />
      </header>

      {/* Hero */}
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 text-center sm:px-6 lg:px-8 lg:pt-16"
      >
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.5em] text-signal/80">enter the signal</p>
          <div className="mt-5">
            <TextScramble
              text="Creative Command Hub"
              as="h1"
              className="font-display text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] sm:text-8xl lg:text-[9.5rem] glow-text"
              delay={400}
            />
          </div>
          <p className="mx-auto mt-7 max-w-2xl text-base font-semibold leading-7 text-white/70 sm:text-xl">
            Music, machines, agents, experiments. A portal map by xsy for everything loud, strange, useful, and still forming.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#map" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-signal">Choose a portal</a>
            <a href="#signal" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-white/45 hover:text-white">Read the signal</a>
          </div>
        </div>
      </motion.section>

      {/* Portal Map */}
      <motion.div
        id="map"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        <PortalMap />
      </motion.div>

      {/* Signal Section */}
      <section id="signal" className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-signal/80">x1c7 signal</p>
            <h2 className="mt-4 font-display text-3xl font-black uppercase tracking-tight sm:text-5xl">Scan signal</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/65">
              The hub is forming. New portals activate as experiments reach critical mass. Check back or tune into the frequency.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-mono uppercase tracking-wider text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-venom" />
                Systems forming
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-mono uppercase tracking-wider text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-plasma" style={{ animationDelay: "0.5s" }} />
                Signal active
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-mono uppercase tracking-wider text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-ember" style={{ animationDelay: "1s" }} />
                Agents standing by
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="portal-ring grid h-8 w-8 place-items-center rounded-xl p-[2px]">
                <span className="grid h-full w-full place-items-center rounded-xl bg-void text-xs font-black">x</span>
              </span>
              <div>
                <span className="block font-display text-sm font-black tracking-[0.2em]">x1c7</span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">creative command hub</span>
              </div>
            </div>
            <nav className="flex flex-wrap justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <Link href="/" className="transition hover:text-signal">Hub</Link>
              <Link href="/music" className="transition hover:text-plasma">Music</Link>
              <Link href="/projects" className="transition hover:text-royal">Projects</Link>
              <Link href="/classified" className="transition hover:text-red-400">Classified</Link>
            </nav>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">
              Built by xsy &middot; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

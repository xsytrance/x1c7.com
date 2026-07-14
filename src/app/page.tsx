"use client";

import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { PortalMap } from "@/components/PortalMap";
import { MobileNav } from "@/components/MobileNav";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { HomeShowcase } from "@/components/HomeShowcase";
import { GalaxyButton } from "@/components/GalaxyButton";

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
          <Link className="transition hover:text-signal" href="/projects">Projects</Link>
          <Link className="transition hover:text-venom" href="/guides">Manual</Link>
          <a className="transition hover:text-plasma" href="#signal">Signal</a>
          <Link className="transition hover:text-ember" href="/classified">Locked</Link>
        </nav>

        {/* Mobile nav */}
        <MobileNav />
      </header>

      {/* Hero */}
      <m.section
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
            AI art, AI music, code, agents, and ideas. A portal map by xsy for everything loud, strange, useful, and still forming.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#map" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-signal">Choose a portal</a>
            <a href="#signal" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-white/45 hover:text-white">Read the signal</a>
          </div>
          {/* The big front door to the music universe */}
          <div className="mx-auto mt-8 max-w-3xl">
            <GalaxyButton compact />
          </div>
        </div>
      </m.section>

      {/* Portal Map */}
      <m.div
        id="map"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        <PortalMap />
      </m.div>

      {/* Showcase: stats, featured builds, latest track */}
      <HomeShowcase />

      {/* Signal Section */}
      <section id="signal" className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-signal/80">x1c7 signal</p>
            <h2 className="mt-4 font-display text-3xl font-black uppercase tracking-tight sm:text-5xl">Scan signal</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/65">
              The signal is live. Portals keep activating as new experiments reach critical mass — fresh builds, tracks, and protocols drop here first.
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

      {/* Connect Band */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-12 lg:px-8">
        <ScrollReveal>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-signal/70">find xsy elsewhere</p>
            <h2 className="mt-4 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              Connect
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/55">
              Music on SoundCloud, code on GitHub, experiments everywhere. The signal extends beyond this hub.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                { name: "GitHub", url: "https://github.com/xsytrance", color: "#8dff4a", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                )},
                { name: "SoundCloud", url: "https://soundcloud.com/rod-agenor", color: "#ff9b3d", icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.21-1.319-.225-1.339c-.01-.057-.043-.094-.063-.094zm1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.105.104.061 0 .105-.045.12-.104l.24-2.474-.255-2.547c-.015-.06-.06-.104-.105-.104zm.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.64c-.015-.075-.06-.135-.166-.135zm.93-.069c-.09 0-.149.075-.165.165l-.18 2.7.195 2.52c.016.09.075.165.165.165.089 0 .165-.075.165-.165l.21-2.52-.225-2.7c0-.09-.075-.165-.165-.165zm.93-.045c-.105 0-.18.09-.18.18l-.165 2.73.18 2.49c.015.105.09.18.18.18.104 0 .179-.09.195-.18l.21-2.49-.21-2.73c-.015-.105-.09-.18-.195-.18zm.915-.06c-.12 0-.21.105-.225.21l-.165 2.85.18 2.37c.016.119.105.225.225.225.12 0 .225-.105.225-.225l.195-2.37-.195-2.85c0-.12-.105-.21-.24-.21z" /></svg>
                )},
                { name: "Suno", url: "https://suno.com/@xsytrance", color: "#ff2440", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l4-4 4 4"/><path d="M12 16V8"/></svg>
                )},
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-full border px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] transition hover:scale-105"
                  style={{
                    borderColor: `${s.color}30`,
                    color: `${s.color}cc`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${s.color}66`;
                    (e.currentTarget as HTMLElement).style.backgroundColor = `${s.color}11`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${s.color}30`;
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  {s.icon}
                  {s.name}
                </a>
              ))}
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("x1c7-toggle-help"))}
              className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/20 transition hover:text-signal/60"
            >
              Press ? for controls
            </button>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}

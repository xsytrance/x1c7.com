import Link from "next/link";
import { PortalMap } from "@/components/PortalMap";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />
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
        <nav className="hidden items-center gap-5 font-mono text-xs uppercase tracking-[0.25em] text-white/55 sm:flex">
          <a className="transition hover:text-signal" href="#map">Map</a>
          <a className="transition hover:text-plasma" href="#signal">Signal</a>
          <Link className="transition hover:text-venom" href="/classified">Locked</Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 text-center sm:px-6 lg:px-8 lg:pt-16">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.5em] text-signal/80">enter the signal</p>
          <h1 className="mt-5 font-display text-6xl font-black uppercase leading-[0.86] tracking-[-0.08em] sm:text-8xl lg:text-[9.5rem]">
            Creative
            <span className="block bg-gradient-to-r from-plasma via-signal to-venom bg-clip-text text-transparent">Command Hub</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base font-semibold leading-7 text-white/70 sm:text-xl">
            Music, machines, agents, experiments. A portal map by xsy for everything loud, strange, useful, and still forming.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#map" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-signal">Choose a portal</a>
            <a href="#signal" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-white/45 hover:text-white">Read the signal</a>
          </div>
        </div>
      </section>

      <div id="map">
        <PortalMap />
      </div>

      <section id="signal" className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">signal report</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <h2 className="font-display text-4xl font-black uppercase leading-none sm:text-6xl">Some rooms are public. Some are still locked.</h2>
            <p className="text-sm leading-7 text-white/65 sm:text-base">
              Version one is the front door: fast, animated, mobile-friendly, and ready for future music players, galleries, notes, agent dashboards, and secret nonsense. No private URLs. No keys. No boring-ass portfolio wall.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

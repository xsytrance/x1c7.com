import type { Metadata } from "next";
import Link from "next/link";

// THE ENGINE ROOM — everything the Kinetica engine learned in the Prism
// integration, organized and pointed at. One page, static, house style.
// The engineering log lives in docs/BUILD-LOG.md; the architecture +
// backlog in docs/PRISM-INTEGRATION.md. This is the showroom.

export const metadata: Metadata = {
  title: "Engine Room — x1c7",
  description: "The Kinetica engine's new senses: melody-colored lyrics, a living generative backdrop, and a show that knows the future of the song.",
};

const GROUPS: {
  title: string;
  tint: string;
  blurb: string;
  features: { name: string; what: string; see: string }[];
}[] = [
  {
    title: "The Words",
    tint: "var(--theme-primary)",
    blurb: "The lyrics know their own music now.",
    features: [
      {
        name: "Melody Sense",
        what: "Every timed word knows the note it was sung on — measured offline from the isolated vocal stem, mapped through the song's key so the tonic wears the theme's own hue and harmony bends it. 43 songs live.",
        see: "Play any catalog song — the words are colored by the melody itself.",
      },
      {
        name: "Melody Motion",
        what: "Words move with the melodic line: rising intervals lift them into place from below, falling lines sink them in, exits lead the ear toward the next note, and high notes sit a touch bigger.",
        see: "Watch a chorus climb — the words climb with it.",
      },
      {
        name: "Word Ghosts",
        what: "A dying word dissolves into the backdrop — stamped once into a decay buffer where it rises and fades in the color of its sung note. The field slowly becomes a painting of the melody.",
        see: "Dynamic or Focus view, any song with a show.",
      },
    ],
  },
  {
    title: "The Field",
    tint: "var(--theme-accent)",
    blurb: "A living generative backdrop breathes behind every show.",
    features: [
      {
        name: "The Living Backdrop",
        what: "Three generative worlds — aurora curtains, ember nebulae, ink tides — painted in the song's palette, seeded per song, fed by the real stems, leaning toward wherever the active lyric lives.",
        see: "Phase 4+ on any show (the default). The art glows over it.",
      },
      {
        name: "Anticipation",
        what: "The engine knows the future: it counts down to the next drop from the measured stems, and the world tenses before it lands — the vignette closes, color drains, time slows. The drop is the release.",
        see: "Any song with a real drop — feel the field hold its breath.",
      },
      {
        name: "A/B Section Decks",
        what: "Two scenes live at once; the song's structure drives the crossfader. Every section emotion owns a world, and changes land on the bar line of the real beat grid.",
        see: "Wait for a verse → chorus turn.",
      },
      {
        name: "Chorus Memory",
        what: "Each section emotion owns a deterministic look — hue, flow, trails, bloom. When the chorus comes back, its world comes back with it.",
        see: "Second chorus. Same colors come home.",
      },
      {
        name: "Key & Mode Awareness",
        what: "The field's accents sing the tonic — the exact hue the words wear on it — and the mode grades the light: major lifts it, minor cools the shadows.",
        see: "Compare a major song against a minor one.",
      },
    ],
  },
  {
    title: "The Instrument",
    tint: "var(--theme-secondary)",
    blurb: "Under the show, a performance rig — inspired by a friend's machine.",
    features: [
      {
        name: "Stem X-Ray",
        what: "Mute an instrument in the mixer and its visuals die with it, honestly. Solo one through the Lens and the backdrop surfaces its anatomy — drums strike rings, bass stands a wave, the voice breathes light around the lyric.",
        see: "Stems button on any stems song → solo an instrument.",
      },
      {
        name: "Looks",
        what: "The show's memory: capture the whole control surface as a named look, fire it back morphed over one bar, share packs as JSON. A look styles the world; it can never touch the controls that run the show.",
        see: "Studio → the Looks card (Phase 4+). Built-ins: Nocturne, Festival, Newsprint.",
      },
      {
        name: "LFOs & Stem-Follows",
        what: "Three beat-synced oscillators and three followers that let a real instrument ride any parameter — phase-locked to the measured grid, breathing under every knob without ever moving it.",
        see: "The backdrop's hue drifts on a 4-bar sine, always.",
      },
    ],
  },
  {
    title: "The Foundation",
    tint: "var(--theme-primary)",
    blurb: "Why all of this ships fast and never lies.",
    features: [
      {
        name: "The Parameter Registry",
        what: "Every knob registers once and becomes morphable, preset-able, and modulation-targetable for free. The pattern that lets the engine grow a feature a day.",
        see: "Console: KINETICA.P — every parameter, live.",
      },
      {
        name: "The Ground-Truth Feature Bus",
        what: "One per-frame snapshot of the song: real per-stem loudness, the measured beat grid, section pulses, riser charge, the active word's position — and beatsToDrop, a countdown no live visualizer can have.",
        see: "Console: KINETICA.featureBus.F while a show plays.",
      },
      {
        name: "The Offline Analyzers",
        what: "Rhythm, mix, and now melody — pitch per word from the vocal stem plus key detection, QA-gated by how diatonic the result is. Measured once, true forever, identical on every playback.",
        see: "43/47 catalog songs passed the gate and are live.",
      },
    ],
  },
];

export default function EngineRoomPage() {
  return (
    <main
      className="min-h-screen px-5 pb-24 pt-14 sm:px-10"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--theme-primary) 16%, transparent), transparent 55%)," +
          "linear-gradient(170deg, var(--theme-bg, #05030b), #05030b)",
      }}
    >
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-white/40">x1c7 · engine room</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl">
          The show learned<br />
          <span style={{ color: "var(--theme-primary)" }}>to hear itself.</span>
        </h1>
        <p className="mt-5 max-w-2xl font-mono text-xs leading-6 tracking-wide text-white/60">
          The Kinetica engine grew a new nervous system: it reads a song&apos;s measured
          stems, its word-level timings, and its sung melody — offline, as facts —
          and performs from ground truth a live visualizer can never have. It knows
          which note every word carries. It knows the drop is coming before it lands.
        </p>
        <p className="mt-3 max-w-2xl font-mono text-[10px] uppercase leading-5 tracking-wider text-white/35">
          Performance-rig architecture inspired by{" "}
          <a href="https://github.com/rockinthiscity/prism" className="underline decoration-white/30 underline-offset-2 hover:text-white/70" target="_blank" rel="noreferrer">
            PRISM
          </a>{" "}
          — Charles&apos;s browser VJ platform — pointed at lyrics, emotion, and meaning.
        </p>

        {/* See it now */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/t/light-it-myself"
            className="rounded-full px-5 py-2.5 font-display text-sm font-black uppercase tracking-[0.15em] text-black transition hover:scale-105"
            style={{ background: "var(--theme-primary)" }}
          >
            ▶ Hear it — Light It Myself
          </Link>
          <Link
            href="/music"
            className="rounded-full border border-white/20 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 transition hover:border-white/50 hover:text-white"
          >
            The full collection
          </Link>
          <a
            href="https://xsytrance.github.io/kinetica/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 transition hover:border-white/50 hover:text-white"
          >
            Kinetica — bring your own stems ↗
          </a>
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">
          43 songs sing in color right now · phase 4+ shows carry the living field · phones get the lean show by design
        </p>

        {/* Feature groups */}
        <div className="mt-14 space-y-12">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="font-display text-xl font-black uppercase tracking-tight" style={{ color: g.tint }}>
                  {g.title}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">{g.blurb}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.features.map((f) => (
                  <div
                    key={f.name}
                    className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm transition hover:border-white/25"
                  >
                    <h3 className="font-display text-sm font-black uppercase tracking-wide text-white">{f.name}</h3>
                    <p className="mt-2 font-mono text-[11px] leading-5 text-white/55">{f.what}</p>
                    <p className="mt-3 font-mono text-[9px] uppercase leading-4 tracking-wider" style={{ color: g.tint }}>
                      ◉ {f.see}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-white/10 pt-6">
          <p className="font-mono text-[10px] uppercase leading-6 tracking-wider text-white/35">
            Everything above is measured, nothing is guessed: the stems are analyzed offline,
            the beat grid is real, the melody is the singer&apos;s. Engineering log in the
            repo — <span className="text-white/55">docs/PRISM-INTEGRATION.md</span> ·{" "}
            <span className="text-white/55">docs/BUILD-LOG.md</span>.
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
            for charles — thanks for opening the machine. 🎛
          </p>
        </div>
      </div>
    </main>
  );
}

"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TYLER HAZE HERO — the guest-of-honor takeover atop /music (2026-07-17).
// Juan (jayodeed) dropped his first album as Tyler Haze; the owner's catalog
// steps back while this holds the spotlight. Everything it shows comes from
// src/data/tylerhaze.ts — delete this component's import in /music to retire
// the takeover. Title letters get the scrawl treatment (per-letter tilt +
// stagger-in) as a nod to the album art's handwritten brush title.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { TYLER, TYLER_LINKS, TYLER_TRACKS, TYLER_GALLERY, TYLER_TRACK_DETAILS } from "@/data/tylerhaze";

// Kinetica-dialect CSS: launch ribbon, letter shatter-on-hover, polaroid
// gallery, ambient accent pulse. Scoped under .tyler-hero; honors
// prefers-reduced-motion.
const KINETIC_CSS = `
@keyframes tyler-ribbon { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes tyler-pulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
.tyler-hero .ribbon-track { animation: tyler-ribbon 22s linear infinite; }
.tyler-hero .pulse { animation: tyler-pulse 2.6s ease-in-out infinite; }
.tyler-hero .shatter-letter { transition: transform .35s cubic-bezier(.2,1.6,.4,1), color .35s, opacity .5s ease; }
.tyler-hero h1:hover .shatter-letter { transform: rotate(var(--sh-rot)) translate(var(--sh-x), var(--sh-y)); color: var(--theme-primary); }
.tyler-hero .polaroid { transition: transform .35s ease, box-shadow .35s ease; }
.tyler-hero .polaroid:hover { transform: rotate(0deg) scale(1.06) !important; box-shadow: 0 18px 50px -12px color-mix(in srgb, var(--theme-primary) 60%, transparent); z-index: 5; }
@media (prefers-reduced-motion: reduce) {
  .tyler-hero .ribbon-track, .tyler-hero .pulse { animation: none; }
  .tyler-hero .shatter-letter { transition: none; }
}
`;

function ScrawlTitle({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 120); return () => clearTimeout(t); }, []);
  let i = 0;
  return (
    <h1 aria-label={text} className="font-display text-4xl font-black leading-[1.02] text-white sm:text-6xl">
      {text.split(" ").map((word, w) => (
        <span key={w} className="inline-block whitespace-nowrap pr-[0.35em]">
          {word.split("").map((ch) => {
            const k = i++;
            const rot = ((k * 137) % 9) - 4; // deterministic scrawl tilt, −4°…+4°
            // shatter vector per letter — hovering the title cracks it apart
            const sx = ((k * 73) % 13) - 6, sy = ((k * 101) % 11) - 5, sr = ((k * 53) % 17) - 8;
            return (
              <span
                key={k}
                className="shatter-letter inline-block"
                style={{
                  "--sh-rot": `${sr}deg`, "--sh-x": `${sx}px`, "--sh-y": `${sy}px`,
                  transform: on ? `rotate(${rot}deg)` : "rotate(0deg) translateY(14px)",
                  opacity: on ? 1 : 0,
                  transitionDelay: on ? undefined : `${k * 28}ms`,
                  textShadow: "0 0 22px color-mix(in srgb, var(--theme-primary) 55%, transparent), 0 2px 24px rgba(0,0,0,.9)",
                } as React.CSSProperties}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

function LaunchRibbon() {
  const chunk = "LAUNCHED TODAY · JULY 17 2026 · THE PARTY LEFT WITHOUT ME · TYLER HAZE · OUT EVERYWHERE · ";
  return (
    <div className="relative overflow-hidden border-b border-white/10 py-2" style={{ background: "color-mix(in srgb, var(--theme-primary) 18%, transparent)" }}>
      <div className="ribbon-track flex w-max whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--theme-secondary)" }}>
        <span>{chunk.repeat(4)}</span><span aria-hidden>{chunk.repeat(4)}</span>
      </div>
    </div>
  );
}

export function TylerHazeHero() {
  return (
    <section className="tyler-hero relative mb-14 overflow-hidden rounded-2xl border border-white/12"
      style={{ background: "linear-gradient(150deg, color-mix(in srgb, var(--theme-bg) 78%, var(--theme-accent)) 0%, var(--theme-bg) 55%, color-mix(in srgb, var(--theme-bg) 86%, var(--theme-primary)) 100%)" }}>
      <style dangerouslySetInnerHTML={{ __html: KINETIC_CSS }} />
      <LaunchRibbon />
      {/* ComfyUI backdrop — dusk porch aftermath, painted for this takeover */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.22]"
        style={{ backgroundImage: "url(https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/tyler-haze/backdrops/porch-dusk.webp)" }} />
      {/* porch-light wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 78% 18%, color-mix(in srgb, var(--theme-secondary) 16%, transparent), transparent 55%)" }} />

      <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[minmax(0,380px)_1fr] md:items-center">
        {/* cover */}
        <a href={TYLER_LINKS[0]?.url} target="_blank" rel="noreferrer"
          className="group relative mx-auto block w-full max-w-[380px] -rotate-1 transition-transform duration-500 hover:rotate-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TYLER.cover} alt={`${TYLER.album} — album cover`}
            className="w-full rounded-xl border border-white/15 shadow-[0_24px_80px_-20px_rgba(0,0,0,.9)]" />
          <span className="absolute -right-3 -top-3 rotate-6 rounded-full px-3 py-1 font-display text-xs font-black tracking-wide text-black shadow-lg"
            style={{ background: "var(--theme-secondary)" }}>
            OUT NOW
          </span>
          <span className="mt-2 block text-center font-mono text-[10px] text-white/40 transition group-hover:text-white/70">
            ↑ tap the cover to listen everywhere
          </span>
        </a>

        {/* copy */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-secondary)" }}>
            {TYLER.released} · debut album · {TYLER.genre} · guest of honor
          </p>
          <p className="mt-2 font-display text-lg font-bold" style={{ color: "var(--theme-primary)" }}>
            TYLER HAZE <span className="text-white/40">· the AI persona of{" "}
              <a href="https://suno.com/@jc_gomez0311" target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white">{TYLER.by}</a></span>
          </p>
          <div className="mt-1">
            <ScrawlTitle text={TYLER.album} />
          </div>

          <blockquote className="mt-5 max-w-xl border-l-2 pl-4 text-[14px] leading-relaxed text-white/80"
            style={{ borderColor: "var(--theme-primary)" }}>
            {TYLER.message}
            <span className="mt-1 block font-mono text-[11px] text-white/45">— xsytrance, proud as hell</span>
          </blockquote>

          {/* LISTEN — clearly labeled streaming row (verified links only) */}
          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-secondary)" }}>
              🎧 Listen — pick your platform
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TYLER_LINKS.map((l, i) => (
                <a key={l.service} href={l.url} target="_blank" rel="noreferrer"
                  className={`rounded-full px-4 py-2 font-mono text-[11.5px] transition hover:scale-[1.04] ${
                    i === 0 ? "font-bold text-black" : "border border-white/25 text-white/80 hover:border-white/60"
                  }`}
                  style={i === 0 ? { background: "var(--theme-primary)" } : undefined}>
                  {l.service}{i === 0 ? " ↗" : ""}
                </a>
              ))}
            </div>
          </div>

          {/* RATED TYLER advisory */}
          <div className="mt-6 inline-block border-2 border-white/70 px-3 py-1.5">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-white/90">Rated Tyler</p>
            <p className="font-mono text-[8.5px] uppercase tracking-wider text-white/55">{TYLER.ratedTyler}</p>
          </div>
        </div>
      </div>

      {/* ⚡ THE SHOW — the spotlight band. This is the gift: the site itself
           performs #MADETOBREAK. Impossible to mistake for a regular button. */}
      <div className="relative border-t px-6 py-6 sm:px-10"
        style={{ borderColor: "color-mix(in srgb, var(--theme-primary) 45%, transparent)", background: "color-mix(in srgb, var(--theme-primary) 8%, transparent)" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>
          ⚡ the main event — watch the show
        </p>
        <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TYLER_TRACK_DETAILS["#MADETOBREAK"]?.art ?? TYLER.cover} alt="#MADETOBREAK single art"
            className="h-20 w-20 flex-none rounded-lg border border-white/20 object-cover sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-black text-white">#MADETOBREAK <span className="text-white/40">— performed by the site itself</span></p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/60">
              64 paintings synced word-by-word to the lyrics · Tyler&apos;s official art woven through ·
              built today for launch day. Headphones on, then hit play.
            </p>
          </div>
          {/* ?reel=1 → KineticStage turns the Curator's reel ghosts on for the session */}
          <Link href={`/t/${TYLER.featuredTrackId}?reel=1`}
            className="pulse flex-none rounded-xl px-8 py-4 font-display text-lg font-black text-black shadow-[0_10px_40px_-8px_var(--theme-primary)] transition hover:scale-[1.05]"
            style={{ background: "var(--theme-primary)" }}>
            ▶ PLAY THE SHOW
          </Link>
        </div>
      </div>

      {/* the 13 — every track a card; #MADETOBREAK gets the full-show glow */}
      <div className="relative border-t border-white/10 px-6 pb-2 pt-5 sm:px-10">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
          💿 the thirteen — track by track <span className="normal-case tracking-normal text-white/30">(tap a card to listen; #MADETOBREAK opens the show)</span>
        </p>
        <p className="mb-3 max-w-3xl font-mono text-[10.5px] leading-relaxed text-white/50">
          It&apos;s a concept album — the songs talk to each other. <i>Distorted In Her Eyes</i> quotes{" "}
          <i>Pretty When I Lie</i>, <i>6th FLR</i> name-drops Jayodeed himself, and the closer lands the thesis:{" "}
          <span className="text-white/75">&ldquo;Sometimes you lose the love of your life because you loved your damage more.&rdquo;</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TYLER_TRACKS.map((t, i) => {
            const d = TYLER_TRACK_DETAILS[t];
            const isShow = t === "#MADETOBREAK";
            const inner = (
              <div className="flex gap-3">
                {d?.art && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={d.art} alt="" loading="lazy" className="h-16 w-16 flex-none rounded-md border border-white/10 object-cover" />
                )}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px]" style={{ color: "var(--theme-secondary)" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={`font-display text-[15px] font-bold ${isShow ? "" : "text-white/90"}`}
                      style={isShow ? { color: "var(--theme-primary)" } : undefined}>{t}</span>
                    {isShow && <span className="pulse ml-auto flex-none rounded-full border px-2 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider"
                      style={{ borderColor: "var(--theme-primary)", color: "var(--theme-primary)" }}>▶ full show</span>}
                  </div>
                  {d?.story && <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-white/50">{d.story}</p>}
                  {d?.words && d.words.length > 0 && (
                    <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-white/35">{d.words.join(" · ")}</p>
                  )}
                </div>
              </div>
            );
            const cls = "block rounded-lg border p-3 transition hover:scale-[1.02] " +
              (isShow ? "border-[color-mix(in_srgb,var(--theme-primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--theme-primary)_9%,transparent)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/30");
            return isShow
              ? <Link key={t} href="/t/madetobreak?reel=1" className={cls}>{inner}</Link>
              : <a key={t} href={TYLER_LINKS[0]?.url} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
          })}
        </div>
      </div>

      {/* official artwork gallery — all 12, straight from Tyler, polaroid wall */}
      <div className="relative border-t border-white/10 px-6 pb-6 pt-4 sm:px-10">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
          🖼 the visual world — official Tyler Haze artwork <span className="normal-case tracking-normal text-white/30">(these also appear inside the show)</span>
        </p>
        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 [scrollbar-width:thin]">
          {TYLER_GALLERY.map((u, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={u} src={u} alt={`Tyler Haze artwork ${i + 1}`} loading="lazy"
              className="polaroid h-36 w-36 flex-none rounded-lg border border-white/12 object-cover sm:h-44 sm:w-44"
              style={{ transform: `rotate(${((i * 47) % 7) - 3}deg)` }} />
          ))}
        </div>
      </div>
    </section>
  );
}

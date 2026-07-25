"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TylerSite, TylerTrack } from "@/lib/tyler/types";

const LAST_KEY = "tyler:last-spotlight";

/**
 * THE ROTATING HIGHLIGHT — the owner's ask: "a different track highlighted on
 * every refresh."
 *
 * The pick happens on the CLIENT, after hydration, on purpose. A server-side
 * random would mean every visitor needs their own uncached render; doing it
 * here keeps one cached HTML document for the whole planet and still gives
 * each refresh a different song. The last one shown is remembered for the tab
 * so you never get the same track twice in a row — "random" that repeats
 * itself reads as broken.
 */
function pickSpotlight(pool: TylerTrack[]): TylerTrack | null {
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];
  let last: string | null = null;
  try {
    last = sessionStorage.getItem(LAST_KEY);
  } catch {
    /* private mode — no memory, still random */
  }
  const fresh = pool.filter((t) => t.id !== last);
  const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  try {
    sessionStorage.setItem(LAST_KEY, pick.id);
  } catch {
    /* ignore */
  }
  return pick;
}

export function TylerHero({ site, tracks }: { site: TylerSite; tracks: TylerTrack[] }) {
  const pool = useMemo(() => tracks.filter((t) => t.spotlight && !t.hidden), [tracks]);
  // Server render and first paint show the album itself; the spotlight arrives
  // a frame later. Nobody sees a flash of nothing, and the HTML stays cacheable.
  const [track, setTrack] = useState<TylerTrack | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => setTrack(pickSpotlight(pool)), [pool]);

  const reroll = () => {
    setRolling(true);
    setTrack(pickSpotlight(pool));
    window.setTimeout(() => setRolling(false), 420);
  };

  const art = track?.art || site.cover;

  return (
    <section className="relative overflow-hidden">
      {/* Backdrop: the art itself, blown out and blurred. One image serves as
          both the poster and its own lighting. */}
      {art && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 scale-110 opacity-40 blur-3xl"
          style={{ backgroundImage: `url(${art})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--t-bg) 55%, transparent), var(--t-bg))" }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-24 md:grid md:grid-cols-[minmax(0,420px)_1fr] md:items-center md:gap-12 md:px-8 md:pb-20 md:pt-32">
        {/* ART — full-bleed square on a phone, a record sleeve on desktop */}
        <div className="relative mx-auto w-full max-w-[420px]">
          <div
            className="aspect-square w-full overflow-hidden rounded-2xl shadow-2xl transition-transform duration-500"
            style={{
              boxShadow: `0 30px 90px -20px color-mix(in srgb, var(--t-primary) 55%, transparent)`,
              transform: rolling ? "scale(0.97) rotate(-1deg)" : undefined,
            }}
          >
            {art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={art}
                alt={track ? `${track.title} — artwork` : `${site.album} — album art`}
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
            ) : (
              <div className="h-full w-full" style={{ background: "linear-gradient(135deg, var(--t-primary), var(--t-accent))" }} />
            )}
          </div>
          {site.rated && (
            <div className="absolute -bottom-3 left-3 rounded border-2 px-2 py-1 text-[9px] font-black uppercase leading-none tracking-widest"
                 style={{ borderColor: "var(--t-secondary)", color: "var(--t-secondary)", background: "rgba(0,0,0,0.75)" }}>
              Rated <span style={{ color: "var(--t-primary)" }}>Tyler</span>
            </div>
          )}
        </div>

        {/* WORDS */}
        <div className="mt-8 md:mt-0">
          {site.tagline && (
            <div className="mb-3 inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em]"
                 style={{ background: "color-mix(in srgb, var(--t-primary) 20%, transparent)", color: "var(--t-primary)" }}>
              {site.tagline}
            </div>
          )}

          <h1
            className="text-[13vw] leading-[0.86] tracking-tight md:text-7xl lg:text-8xl"
            style={{ fontFamily: "var(--t-display)" }}
          >
            {site.album}
          </h1>

          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-white/50">
            {site.artist} · {site.by_line}
            {site.genre ? ` · ${site.genre}` : ""}
          </p>

          {/* TONIGHT'S TRACK — the every-refresh highlight */}
          <div
            className="mt-6 rounded-2xl border p-4 transition-opacity duration-300 md:p-5"
            style={{
              borderColor: "color-mix(in srgb, var(--t-primary) 30%, transparent)",
              background: "color-mix(in srgb, var(--t-primary) 8%, transparent)",
              opacity: track ? 1 : 0.35,
            }}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--t-secondary)" }}>
              Tonight&rsquo;s track
              <button
                onClick={reroll}
                className="ml-auto rounded-full border px-2 py-1 text-[10px] tracking-normal text-white/60 transition-colors hover:text-white"
                style={{ borderColor: "color-mix(in srgb, var(--t-primary) 30%, transparent)" }}
                aria-label="Show a different track"
              >
                ↻ another
              </button>
            </div>

            <div className="mt-2 min-h-[3.5rem]">
              <div className="text-2xl leading-tight md:text-3xl" style={{ fontFamily: "var(--t-display)" }}>
                {track?.title ?? site.album}
              </div>
              {track?.story && <p className="mt-2 text-sm leading-relaxed text-white/65">{track.story}</p>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {track?.show_slug && (
                <Link
                  href={`/t/${track.show_slug}?reel=1`}
                  className="rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-transform active:scale-95"
                  style={{ background: "var(--t-primary)", color: "#fff" }}
                >
                  ▶ Watch the show
                </Link>
              )}
              {site.links[0] && (
                <a
                  href={site.links[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-transform active:scale-95"
                  style={{ borderColor: "var(--t-secondary)", color: "var(--t-secondary)" }}
                >
                  Listen everywhere
                </a>
              )}
              {track?.suno_url && (
                <a
                  href={track.suno_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/15 px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-white/60 transition-colors hover:text-white"
                >
                  On Suno
                </a>
              )}
            </div>
          </div>

          {site.message && (
            <blockquote className="mt-6 border-l-2 pl-4 text-sm leading-relaxed text-white/55" style={{ borderColor: "var(--t-accent)" }}>
              {site.message}
            </blockquote>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import type { TylerMedia, TylerSite, TylerTrack } from "@/lib/tyler/types";

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-4xl leading-none md:text-6xl"
      style={{ fontFamily: "var(--t-display)" }}
    >
      {children}
    </h2>
  );
}

// ── SONGS ─────────────────────────────────────────────────────────────────
// A phone gets one tappable row per song that opens in place — no navigation,
// no modal to dismiss with a tiny ✕. Desktop gets the same rows in two columns
// so the tracklist reads as a sleeve back, not an endless scroll.
export function TrackList({ tracks }: { tracks: TylerTrack[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!tracks.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
      <Heading id="tracks">Songs</Heading>
      <ol className="mt-6 grid gap-2 md:grid-cols-2 md:gap-x-8">
        {tracks.map((t, i) => {
          const isOpen = open === t.id;
          const expandable = !!(t.story || t.words.length || t.show_slug || t.links.length);
          return (
            <li key={t.id} className="border-b border-white/10">
              <button
                onClick={() => expandable && setOpen(isOpen ? null : t.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
              >
                <span className="w-6 shrink-0 font-mono text-xs text-white/30">{String(i + 1).padStart(2, "0")}</span>
                {t.art && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.art} alt="" className="h-11 w-11 shrink-0 rounded object-cover" loading="lazy" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{t.title}</span>
                  {t.subtitle && <span className="block truncate text-xs text-white/40">{t.subtitle}</span>}
                </span>
                {t.show_slug && (
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                        style={{ background: "color-mix(in srgb, var(--t-primary) 25%, transparent)", color: "var(--t-primary)" }}>
                    show
                  </span>
                )}
                {expandable && <span className={`shrink-0 text-white/30 transition-transform ${isOpen ? "rotate-180" : ""}`}>⌄</span>}
              </button>

              {isOpen && (
                <div className="pb-5 pl-9 pr-2 text-sm">
                  {t.story && <p className="leading-relaxed text-white/65">{t.story}</p>}
                  {!!t.words.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.words.map((w) => (
                        <span key={w} className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest"
                              style={{ background: "color-mix(in srgb, var(--t-accent) 18%, transparent)", color: "var(--t-accent)" }}>
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {t.show_slug && (
                      <Link href={`/t/${t.show_slug}?reel=1`}
                            className="rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.15em]"
                            style={{ background: "var(--t-primary)", color: "#fff" }}>
                        ▶ Watch the show
                      </Link>
                    )}
                    {t.links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                         className="rounded-full border border-white/15 px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-white/65 transition-colors hover:text-white">
                        {l.service}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── PHOTOS ────────────────────────────────────────────────────────────────
// A phone scrolls a snapping filmstrip (thumb flick, no grid of stamps);
// desktop opens into a real gallery. Tapping either one goes full-bleed.
export function Photos({ media }: { media: TylerMedia[] }) {
  const [full, setFull] = useState<TylerMedia | null>(null);
  const photos = media.filter((m) => m.kind === "photo");
  if (!photos.length) return null;

  return (
    <section className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <Heading id="photos">Photos</Heading>
      </div>

      <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-8">
        {photos.map((p) => (
          <button
            key={p.id}
            onClick={() => setFull(p)}
            className="w-[78vw] shrink-0 snap-center overflow-hidden rounded-xl md:w-auto"
            aria-label={p.alt || p.caption || "Open photo"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.alt || ""} loading="lazy"
                 className="aspect-square w-full object-cover transition-transform duration-500 md:hover:scale-105" />
            {p.caption && <span className="block px-1 pt-2 text-left text-xs text-white/45">{p.caption}</span>}
          </button>
        ))}
      </div>

      {full && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
             onClick={() => setFull(null)} role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={full.url} alt={full.alt || ""} className="max-h-full max-w-full object-contain" />
          <button className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-2 text-sm"
                  style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
                  onClick={() => setFull(null)}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}

// ── PRESS & LINKS ─────────────────────────────────────────────────────────
export function Press({ site, media }: { site: TylerSite; media: TylerMedia[] }) {
  const kit = media.filter((m) => m.kind === "press" || m.kind === "flyer" || m.kind === "logo");
  if (!site.links.length && !site.socials.length && !kit.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
      <Heading id="press">Press &amp; links</Heading>

      {!!site.links.length && (
        <>
          <p className="mt-6 text-xs uppercase tracking-[0.25em] text-white/40">Listen</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {site.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                 className="rounded-xl border px-4 py-4 text-center text-sm font-semibold transition-transform active:scale-95"
                 style={{ borderColor: "color-mix(in srgb, var(--t-primary) 28%, transparent)" }}>
                {l.service}
              </a>
            ))}
          </div>
        </>
      )}

      {!!kit.length && (
        <>
          <p className="mt-10 text-xs uppercase tracking-[0.25em] text-white/40">Press kit</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {kit.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-3 rounded-xl border border-white/10 p-3 transition-colors hover:border-white/25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.content_type?.startsWith("image/") && <img src={m.url} alt="" className="h-12 w-12 rounded object-cover" loading="lazy" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm">{m.caption || m.r2_key.split("/").pop()}</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/35">{m.kind}</span>
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      {!!site.socials.length && (
        <div className="mt-10 flex flex-wrap gap-3">
          {site.socials.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
               className="text-sm uppercase tracking-[0.2em] text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline">
              {s.service}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

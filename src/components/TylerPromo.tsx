"use client";

import Link from "next/link";
import { TYLER, TYLER_LINKS } from "@/data/tylerhaze";

/**
 * The guest block on /music. Tyler moved out to his own site on 2026-07-25,
 * but the owner's message doesn't retire with the takeover — the collection
 * comes first now, and this sits underneath it as the standing invitation.
 *
 * Reads the archived facts from src/data/tylerhaze.ts (verified links only,
 * the rule from release day). Juan's living, editable version of all this is
 * on his own site; this block is x1c7's pointer to it.
 */
export function TylerPromo() {
  return (
    <section className="relative z-10 mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div
        className="overflow-hidden rounded-3xl border md:grid md:grid-cols-[minmax(0,340px)_1fr]"
        style={{ borderColor: "#d9342b55", background: "linear-gradient(135deg, #080b18, #0d0710)" }}
      >
        <Link href="/tyler" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={TYLER.cover}
            alt={`${TYLER.album} — album art`}
            className="aspect-square w-full object-cover transition-transform duration-700 hover:scale-105"
            loading="lazy"
          />
        </Link>

        <div className="p-6 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em]" style={{ color: "#ffb45c" }}>
            friend of the house · out now
          </p>
          <h2 className="mt-3 font-display text-3xl font-black uppercase leading-none tracking-tight md:text-5xl">
            {TYLER.artist}
          </h2>
          <p className="mt-1 text-lg text-white/70 md:text-xl">{TYLER.album}</p>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/55">{TYLER.message}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/tyler"
              className="rounded-full px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition-transform active:scale-95"
              style={{ background: "#d9342b" }}
            >
              Enter Tyler&rsquo;s world →
            </Link>
            {TYLER_LINKS.slice(0, 3).map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border px-5 py-3 text-xs uppercase tracking-[0.18em] transition-colors"
                style={{ borderColor: "#ffb45c55", color: "#ffb45c" }}
              >
                {l.service}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

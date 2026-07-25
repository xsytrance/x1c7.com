"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TylerSite } from "@/lib/tyler/types";

/**
 * The only chrome on the page. On a phone it's a single translucent bar that
 * gets out of the way as you scroll and never covers the art; on desktop it
 * grows into a real header with the section links.
 *
 * No hamburger: there are four destinations, and a menu you have to open is a
 * menu a stranger won't.
 */
export function TylerNav({ site }: { site: TylerSite }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sections = site.sections.filter((s) => s.visible);
  const has = (id: string) => sections.some((s) => s.id === id);

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 transition-colors duration-300"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        background: solid ? "color-mix(in srgb, var(--t-bg) 88%, transparent)" : "transparent",
        backdropFilter: solid ? "blur(14px)" : undefined,
        borderBottom: solid ? "1px solid color-mix(in srgb, var(--t-primary) 22%, transparent)" : "1px solid transparent",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8 md:py-4">
        <Link
          href="/tyler"
          className="min-w-0 truncate text-lg leading-none tracking-wide md:text-2xl"
          style={{ fontFamily: "var(--t-display)", color: "var(--t-primary)" }}
        >
          {site.artist}
        </Link>

        <div className="ml-auto hidden items-center gap-6 text-xs uppercase tracking-[0.2em] text-white/60 md:flex">
          {has("tracks") && <a className="transition-colors hover:text-white" href="#tracks">Songs</a>}
          {has("photos") && <a className="transition-colors hover:text-white" href="#photos">Photos</a>}
          {has("press") && <a className="transition-colors hover:text-white" href="#press">Press</a>}
          {/* Juan's permanent door — small, but always in the same place. */}
          <Link href="/tyler/admin" className="transition-colors hover:text-white">My site</Link>
        </div>

        {/* The one action that matters, thumb-reachable on every screen. */}
        {site.links[0] && (
          <a
            href={site.links[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition-transform active:scale-95 md:ml-0 md:text-xs"
            style={{ background: "var(--t-primary)", color: "#fff" }}
          >
            Listen
          </a>
        )}
      </nav>
    </header>
  );
}
